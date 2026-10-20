import type { Genome } from "../genome/Genome";
import { mulberry32 } from "../util/random";
import { GAIT_START_TIME, Racer, STEP } from "./Racer";

// Odds as a fraction: a winning bet pays "num" for every "den" staked, plus the stake back.
// So 4-1 pays 4 for every 1 (a $25 bet returns $125) and 1-2 pays 1 for every 2.
export interface Odds {
  num: number;
  den: number;
}

const HOUSE_RETURN = 0.85; // the house keeps the rest; on average bettors get back about 85%
const MIN_PROBABILITY = 0.04; // caps the longest odds at about 20-1 (real win rates of long shots run a bit above their estimate)
const COMBINATIONS = 20000; // how many imaginary races to draw from the simulated horse-runs

// Early exit for hopeless runs. Measured on 150 horses that went on to finish a 100 m track:
// none was ever slower than about 0.95 m/s on average, and 5.6 m along at 10 s. So a horse that
// is far behind a slow walk can be written off without simulating the rest of its 100 seconds.
// (This is tied to the 100 m track. If the track changes, measure again.)
const PRUNE_FROM = 10; // seconds
const PRUNE_SPEED = 0.35; // m/s: behind (PRUNE_SPEED * t - PRUNE_OFFSET) means "will not finish"
const PRUNE_OFFSET = 2; // meters
const STEPS_PER_SECOND = Math.round(1 / STEP);

export function oddsFromProbability(p: number): Odds {
  const prob = Math.min(0.99, Math.max(MIN_PROBABILITY, p));
  const decimal = Math.max(1.1, HOUSE_RETURN / prob); // total return per $1 staked
  const profit = decimal - 1;
  if (profit >= 1) {
    return { num: Math.min(50, Math.round(profit)), den: 1 };
  }
  return { num: 1, den: Math.min(10, Math.max(2, Math.round(1 / profit))) };
}

export function formatOdds(odds: Odds): string {
  return `${odds.num}-${odds.den}`;
}

// What a winning bet pays out in total (the stake is included).
export function prizeFor(bet: number, odds: Odds): number {
  return Math.floor((bet * (odds.num + odds.den)) / odds.den);
}

// Works out each horse's chance of winning by simulating it many times.
//
// A race is fully predictable if you know the horses and each horse's reaction time, so the
// odds come from simulating every horse with many *other* random reaction times. Horses race
// in separate physics worlds and never touch, so each horse can be simulated alone, and any
// combination of one run per horse is a valid imaginary race.
//
// A full set takes a few seconds of computing, so work() does a little at a time.
export class OddsCalculator {
  done = false;
  probabilities: number[] = [];
  odds: Odds[] = [];

  private readonly genomes: Genome[];
  private readonly trackLength: number;
  private readonly timeCap: number; // seconds: the race's time limit; slower horses do not finish
  private readonly totalRuns: number;
  private readonly times: number[][];
  private readonly seedRng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  private nextRun = 0;

  constructor(genomes: Genome[], trackLength: number, timeLimit: number, samplesPerHorse = 16) {
    this.genomes = genomes;
    this.trackLength = trackLength;
    this.timeCap = timeLimit;
    this.totalRuns = genomes.length * samplesPerHorse;
    this.times = genomes.map(() => []);
  }

  get progress(): number {
    return Math.min(1, this.nextRun / this.totalRuns);
  }

  // Run simulations until about budgetMs milliseconds have passed.
  work(budgetMs: number): void {
    const start = performance.now();
    while (!this.done) {
      this.runOne();
      if (this.nextRun >= this.totalRuns) {
        this.finish();
        break;
      }
      if (performance.now() - start >= budgetMs) break;
    }
  }

  private runOne(): void {
    const horse = this.nextRun % this.genomes.length; // rotate through the horses
    const seed = Math.floor(this.seedRng() * 2 ** 31);
    const racer = new Racer("sim", this.genomes[horse] ?? [], this.trackLength, seed);
    const maxSteps = Math.ceil((this.timeCap + GAIT_START_TIME) / STEP);
    for (let i = 0; i < maxSteps && racer.status === "running"; i++) {
      racer.step(i);
      if (i % STEPS_PER_SECOND === 0) {
        const t = i * STEP - GAIT_START_TIME;
        if (t >= PRUNE_FROM && racer.distance < PRUNE_SPEED * t - PRUNE_OFFSET) break; // hopeless
      }
    }
    this.times[horse]?.push(racer.status === "finished" ? racer.finishTime : Infinity);
    this.nextRun++;
  }

  private finish(): void {
    const n = this.genomes.length;
    const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
    const wins = new Array<number>(n).fill(0);
    let decided = 0;

    for (let c = 0; c < COMBINATIONS; c++) {
      let best = Infinity;
      let winner = -1;
      for (let h = 0; h < n; h++) {
        const runs = this.times[h] ?? [];
        const t = runs[Math.floor(rng() * runs.length)] ?? Infinity;
        if (t < best) {
          best = t;
          winner = h;
        }
      }
      if (winner >= 0) {
        wins[winner] = (wins[winner] ?? 0) + 1;
        decided++;
      }
    }

    // +1 for each horse so nobody gets a chance of exactly zero
    this.probabilities = wins.map((w) => (w + 1) / (decided + n));
    this.odds = this.probabilities.map(oddsFromProbability);
    this.done = true;
  }
}