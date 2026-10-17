import { Edge, World } from "planck";
import { PhysicsHorse } from "../physics/PhysicsHorse";
import { decodeGenome } from "../genome/Genome";
import type { Genome } from "../genome/Genome";

export const STEP = 1 / 60; // fixed physics step, in seconds
export const GAIT_START_TIME = 1; // seconds of standing still before the gait starts
const FALLEN_TILT = (75 * Math.PI) / 180; // tilted past this = fell over

export type RacerStatus = "running" | "finished" | "fell" | "timeout";

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

  constructor(name: string, genome: Genome, trackLength: number) {
    this.name = name;
    this.genome = genome;
    this.trackLength = trackLength;
    this.world.createBody().createFixture(new Edge({ x: -1000, y: 0 }, { x: 1000, y: 0 }), { friction: 1 });
    this.horse = new PhysicsHorse(this.world, 0, 0, decodeGenome(genome));
  }

  // Meters travelled from the start line (never negative).
  get distance(): number {
    return Math.max(0, this.horse.torso.getPosition().x);
  }

  // Advance one fixed physics step. stepIndex counts steps since the race began.
  step(stepIndex: number): void {
    if (this.status !== "running") return;

    const time = stepIndex * STEP;
    if (stepIndex === Math.round(GAIT_START_TIME / STEP)) {
      this.horse.start();
    }
    this.horse.update(STEP);
    this.world.step(STEP, 8, 3);

    const a = this.horse.torso.getAngle();
    const tilt = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); // angle wrapped to -180..180
    if (tilt > FALLEN_TILT) {
      this.status = "fell";
    } else if (this.horse.torso.getPosition().x >= this.trackLength) {
      this.status = "finished";
      this.finishTime = time - GAIT_START_TIME;
    }
  }
}