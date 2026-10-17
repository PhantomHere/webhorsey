import type { Mode } from "../core/Mode";
import { drawHorse } from "../render/drawHorse";
import type { Racer } from "../race/Racer";
import { createRace } from "../race/createRace";
import type { PhysicsRace } from "../race/PhysicsRace";

const SPEEDS = [1, 2, 4]; // playback speed options

export class RaceMode implements Mode {
  private race: PhysicsRace = createRace();
  private speedIndex = 0; // starts at 1x

  // Arrow function so "this" still points at the mode when the browser calls it.
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Space") {
      e.preventDefault();
      if (this.race.state === "waiting") {
        this.race.start();
      } else if (this.race.state === "finished") {
        this.race = createRace();
      }
    } else if (e.code === "KeyF") {
      this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    }
  };

  enter(): void {
    window.addEventListener("keydown", this.onKeyDown);
    this.race = createRace();
  }

  exit(): void {
    window.removeEventListener("keydown", this.onKeyDown);
  }

  update(dt: number): void {
    // Playback speed only changes how many fixed steps run per frame, never the outcome.
    this.race.update(dt * (SPEEDS[this.speedIndex] ?? 1));
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const race = this.race;
    const count = race.racers.length;

    // Layout
    const labelW = 230;
    const right = width - 40;
    const top = 100;
    const bottom = height - 30;
    const laneH = (bottom - top) / count;
    const scale = Math.min(laneH / 2.4, (right - labelW) / race.trackLength); // pixels per meter
    const startX = labelW + (right - labelW - race.trackLength * scale) / 2;
    const finishX = startX + race.trackLength * scale;

    ctx.fillStyle = "#1b3a17";
    ctx.fillRect(0, 0, width, height);

    // Lanes first, then horses on top, so no lane covers a neighbouring horse.
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#2d5a27" : "#27501f";
      ctx.fillRect(0, top + i * laneH, width, laneH);
    }

    // Start and finish lines
    ctx.fillStyle = "#ffffff88";
    ctx.fillRect(startX, top, 2, bottom - top);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(finishX, top, 4, bottom - top);

    race.racers.forEach((racer, i) => {
      const groundY = top + (i + 1) * laneH - 12;

      // Ground line for this lane
      ctx.fillStyle = "#00000033";
      ctx.fillRect(0, groundY, width, 2);

      this.drawRacer(ctx, racer, startX, groundY, scale);

      // Name panel on top, so a horse that walks backward slides out of sight behind it.
      ctx.fillStyle = i % 2 === 0 ? "#2d5a27" : "#27501f";
      ctx.fillRect(0, top + i * laneH, labelW - 20, laneH);
      this.drawLabel(ctx, racer, 12, groundY - laneH / 2 + 10);
    });

    // Header
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px sans-serif";
    if (race.state === "waiting") {
      ctx.fillText("Press SPACE to start the race", 20, 40);
    } else if (race.state === "running") {
      ctx.fillText(
        race.raceTime < 0 ? "Get ready..." : `Race time: ${race.raceTime.toFixed(1)} s`,
        20,
        40,
      );
    } else {
      ctx.fillText("Finished! Press SPACE for a new race", 20, 40);
    }
    ctx.font = "16px sans-serif";
    ctx.fillText(`[F] playback speed: ${SPEEDS[this.speedIndex]}x   [2] horse test`, 20, 70);

    // Results panel
    if (race.state === "finished") {
      const panelW = 460;
      const panelH = 70 + race.results.length * 30;
      const px = (width - panelW) / 2;
      const py = (height - panelH) / 2;

      ctx.fillStyle = "#000000cc";
      ctx.fillRect(px, py, panelW, panelH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "22px sans-serif";
      ctx.fillText("Results", px + 20, py + 38);

      ctx.font = "18px sans-serif";
      race.results.forEach((racer, i) => {
        ctx.fillText(`${i + 1}. ${racer.name}  -  ${this.describe(racer)}`, px + 20, py + 70 + i * 30);
      });
    }
  }

  private describe(racer: Racer): string {
    if (racer.status === "finished") return `${racer.finishTime.toFixed(2)} s`;
    if (racer.status === "fell") return `fell at ${racer.distance.toFixed(1)} m`;
    if (racer.distance < -0.5) return `walked backward to ${racer.distance.toFixed(1)} m`;
    return `stopped at ${racer.distance.toFixed(1)} m`;
  }

  private drawLabel(ctx: CanvasRenderingContext2D, racer: Racer, x: number, y: number): void {
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";
    ctx.fillText(racer.name, x, y);

    ctx.font = "14px sans-serif";
    ctx.fillStyle = racer.status === "fell" ? "#ff8a80" : racer.status === "finished" ? "#b9f6ca" : "#dddddd";
    const text =
      racer.status === "running"
        ? `${racer.distance.toFixed(1)} m`
        : racer.status === "finished"
          ? "FINISHED"
          : racer.status === "fell"
            ? "FELL"
            : "STOPPED";
    ctx.fillText(text, x, y + 20);
  }

  private drawRacer(
    ctx: CanvasRenderingContext2D,
    racer: Racer,
    startX: number,
    groundY: number,
    scale: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = racer.status === "fell" ? 0.5 : 1;
    drawHorse(ctx, racer.horse, startX, groundY, scale);
    ctx.restore();
  }
}