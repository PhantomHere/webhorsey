import { GAIT_START_TIME, STEP } from "./Racer";
import type { Racer } from "./Racer";

export type RaceState = "waiting" | "running" | "finished";

// After the first horse finishes, the others get this long to cross the line.
const GRACE_AFTER_FIRST_FINISH = 15; // seconds

export class PhysicsRace {
  readonly racers: Racer[];
  readonly trackLength: number; // meters
  readonly timeLimit: number; // seconds after the gait starts

  state: RaceState = "waiting";
  results: Racer[] = []; // final order, filled in when the race ends

  private steps = 0;
  private accumulator = 0;
  private firstFinishAt: number | null = null;

  constructor(racers: Racer[], trackLength: number, timeLimit: number) {
    this.racers = racers;
    this.trackLength = trackLength;
    this.timeLimit = timeLimit;
  }

  // Seconds since the gait started. Negative while the horses are still settling.
  get raceTime(): number {
    return this.steps * STEP - GAIT_START_TIME;
  }

  start(): void {
    if (this.state === "waiting") {
      this.state = "running";
    }
  }

  update(dt: number): void {
    if (this.state !== "running") return;

    // Fixed steps, so a race plays out identically at any frame rate or playback speed.
    this.accumulator += dt;
    while (this.accumulator >= STEP && this.state === "running") {
      this.accumulator -= STEP;
      this.stepOnce();
    }
  }

  private stepOnce(): void {
    for (const racer of this.racers) {
      racer.step(this.steps);
    }
    this.steps++;

    const elapsed = this.raceTime;
    if (this.firstFinishAt === null && this.racers.some((r) => r.status === "finished")) {
      this.firstFinishAt = elapsed;
    }

    const allDone = this.racers.every((r) => r.status !== "running");
    const graceOver =
      this.firstFinishAt !== null && elapsed >= this.firstFinishAt + GRACE_AFTER_FIRST_FINISH;
    if (allDone || graceOver || elapsed >= this.timeLimit) {
      this.finish();
    }
  }

  private finish(): void {
    for (const racer of this.racers) {
      if (racer.status === "running") racer.status = "timeout";
    }
    // Finishers first, by time. Everyone else is ranked by how far they got.
    const finishers = this.racers
      .filter((r) => r.status === "finished")
      .sort((a, b) => a.finishTime - b.finishTime);
    const others = this.racers
      .filter((r) => r.status !== "finished")
      .sort((a, b) => b.distance - a.distance);
    this.results = [...finishers, ...others];
    this.state = "finished";
  }
}