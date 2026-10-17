import type { Mode } from "../core/Mode";
import { Race } from "../race/Race";
import { createHorses } from "../race/horseFactory";

const HORSE_COUNT = 5;
const TRACK_LENGTH = 600; // meters

export class RaceMode implements Mode {
  private race = new Race(createHorses(HORSE_COUNT), TRACK_LENGTH);

  // Arrow function so "this" still points at the mode when the browser calls it.
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== "Space") return;
    e.preventDefault();

    if (this.race.state === "waiting") {
      this.race.start();
    } else if (this.race.state === "finished") {
      this.newRace();
    }
  };

  private newRace(): void {
    this.race = new Race(createHorses(HORSE_COUNT), TRACK_LENGTH);
  }

  enter(): void {
    window.addEventListener("keydown", this.onKeyDown);
    this.newRace();
  }

  exit(): void {
    window.removeEventListener("keydown", this.onKeyDown);
  }

  update(dt: number): void {
    this.race.update(dt);
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const race = this.race;

    // Layout
    const left = 170; // start line x
    const right = width - 60; // finish line x
    const top = 80;
    const bottom = height - 40;
    const laneH = (bottom - top) / race.horses.length;

    // Background
    ctx.fillStyle = "#1b3a17";
    ctx.fillRect(0, 0, width, height);

    // Lanes
    race.horses.forEach((horse, i) => {
      const y = top + i * laneH;

      ctx.fillStyle = i % 2 === 0 ? "#2d5a27" : "#27501f";
      ctx.fillRect(0, y, width, laneH);

      // Name + energy bar
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px sans-serif";
      ctx.fillText(horse.name, 12, y + laneH / 2 - 2);

      ctx.fillStyle = "#00000066";
      ctx.fillRect(12, y + laneH / 2 + 6, 120, 6);
      ctx.fillStyle = "#7CFC00";
      ctx.fillRect(12, y + laneH / 2 + 6, 120 * (horse.energy / horse.stats.stamina), 6);

      // Horse (a colored block for now; its front edge is its position)
      const hx = left + (horse.position / race.trackLength) * (right - left);
      const hh = Math.min(laneH * 0.6, 30);
      ctx.fillStyle = horse.color;
      ctx.fillRect(hx - 44, y + (laneH - hh) / 2, 44, hh);
    });

    // Start and finish lines
    ctx.fillStyle = "#ffffff88";
    ctx.fillRect(left, top, 2, bottom - top);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(right, top, 4, bottom - top);

    // Header
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px sans-serif";
    if (race.state === "waiting") {
      ctx.fillText("Press SPACE to start the race", 20, 45);
    } else if (race.state === "running") {
      ctx.fillText(`Race time: ${race.time.toFixed(1)} s`, 20, 45);
    } else {
      ctx.fillText("Finished! Press SPACE for a new race", 20, 45);
    }

    // Results panel
    if (race.state === "finished") {
      const panelW = 380;
      const panelH = 70 + race.results.length * 30;
      const px = (width - panelW) / 2;
      const py = (height - panelH) / 2;

      ctx.fillStyle = "#000000cc";
      ctx.fillRect(px, py, panelW, panelH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "22px sans-serif";
      ctx.fillText("Results", px + 20, py + 38);

      ctx.font = "18px sans-serif";
      race.results.forEach((horse, i) => {
        ctx.fillText(
          `${i + 1}. ${horse.name}  -  ${horse.finishTime.toFixed(2)} s`,
          px + 20,
          py + 70 + i * 30,
        );
      });
    }
  }
}