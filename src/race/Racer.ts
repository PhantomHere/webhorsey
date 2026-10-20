import { Edge, World } from "planck";
import { PhysicsHorse } from "../physics/PhysicsHorse";
import { decodeGenome } from "../genome/Genome";
import { mulberry32 } from "../util/random";
import type { Genome } from "../genome/Genome";

export const STEP = 1 / 60; // fixed physics step, in seconds
export const GAIT_START_TIME = 1; // seconds of standing still before the gait starts
// Each horse's "reaction time": it starts moving up to this many physics steps late.
// The gait is very sensitive to timing, so this is what makes a race unpredictable.
const MAX_START_JITTER = 12;

const DOWN_TILT = (75 * Math.PI) / 180; // tilted past this = the horse is on the ground

export type RacerStatus = "running" | "finished" | "timeout";

// One horse in its own private physics world, so horses never bump into each other.
// Same genome in, same result out: nothing here uses random numbers.
export class Racer {
  readonly name: string;
  readonly genome: Genome;
  readonly horse: PhysicsHorse;
  status: RacerStatus = "running";
  finishTime = 0; // seconds since the gait started (only for finishers)

  private readonly world = new World({ x: 0, y: -10 });
  private readonly trackLength: number;
  private readonly gaitStartStep: number;

  // seed picks this horse's reaction time. Same genome + same seed = exactly the same race.
  constructor(name: string, genome: Genome, trackLength: number, seed = 0) {
    this.name = name;
    this.genome = genome;
    this.trackLength = trackLength;
    this.gaitStartStep = Math.round(GAIT_START_TIME / STEP) + Math.floor(mulberry32(seed)() * (MAX_START_JITTER + 1));
    this.world.createBody().createFixture(new Edge({ x: -1000, y: 0 }, { x: 1000, y: 0 }), { friction: 1 });
    this.horse = new PhysicsHorse(this.world, 0, 0, decodeGenome(genome));
  }

  // Meters from the start line. Negative means the horse walked backward.
  get distance(): number {
    return this.horse.torso.getPosition().x;
  }

  // True while the horse is tipped over (on its side or back). It can still crawl and finish.
  get isDown(): boolean {
    const a = this.horse.torso.getAngle();
    return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > DOWN_TILT; // angle wrapped to -180..180
  }

  // Advance one fixed physics step. stepIndex counts steps since the race began.
  // Every horse keeps simulating for the whole race, even after it falls. After crossing the line it pulls up.
  step(stepIndex: number): void {
    if (stepIndex === this.gaitStartStep) {
      this.horse.start();
    }
    this.horse.update(STEP);
    this.world.step(STEP, 8, 3);

    if (this.status === "running" && this.horse.torso.getPosition().x >= this.trackLength) {
      this.status = "finished";
      this.finishTime = stepIndex * STEP - GAIT_START_TIME;
      this.horse.stop(); // pull up after the line; the recorded time is already locked in
    }
  }
}