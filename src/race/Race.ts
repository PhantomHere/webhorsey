import type { Horse } from "./Horse";

export type RaceState = "waiting" | "running" | "finished";

export class Race {
  readonly horses: Horse[];
  readonly trackLength: number; // meters

  state: RaceState = "waiting";
  time = 0; // seconds since the start
  results: Horse[] = []; // finishers in order

  constructor(horses: Horse[], trackLength: number) {
    this.horses = horses;
    this.trackLength = trackLength;
  }

  start(): void {
    if (this.state === "waiting") {
      this.state = "running";
    }
  }

  update(dt: number): void {
    if (this.state !== "running") return;

    this.time += dt;

    for (const horse of this.horses) {
      if (horse.finished) continue;

      horse.update(dt, this.trackLength);

      if (horse.position >= this.trackLength) {
        // The horse crossed the line somewhere *inside* this frame.
        // Work out roughly when, so two horses finishing in the same frame
        // are still ranked fairly.
        const overshoot = horse.position - this.trackLength;
        horse.finishTime = this.time - overshoot / horse.speed;
        horse.position = this.trackLength;
        horse.finished = true;
        this.results.push(horse);
      }
    }

    this.results.sort((a, b) => a.finishTime - b.finishTime);

    if (this.results.length === this.horses.length) {
      this.state = "finished";
    }
  }
}