import type { Mode } from "../core/Mode";
import { createRace } from "../race/createRace";
import type { PhysicsRace } from "../race/PhysicsRace";
import type { Racer } from "../race/Racer";
import { drawHorse } from "../render/drawHorse";
import {
  drawFence,
  drawFinishPole,
  drawGrandstand,
  GRASS,
  LANE_LINE,
  PIXEL_FONT,
  SKY,
} from "../render/scenery";

const SPEEDS = [1, 2, 4]; // playback speed options

// Each lane has its own color, used for the name and the numbered saddle cloth.
const LANE_COLORS = ["#e8365d", "#2ed3c0", "#c9a800", "#c43fd1", "#3a5fe0"];

// Where things sit on screen, as fractions of the screen width.
const START_AT = 0.17; // the start line when the camera is at its leftmost
const FINISH_AT = 0.77; // the finish line when the camera is at its rightmost
const LEADER_AT = 0.6; // the camera keeps the leading horse around here

const PIXELS_PER_SCREEN_WIDTH_METER = 20; // the screen shows about 20 meters

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class RaceMode implements Mode {
  private race: PhysicsRace = createRace();
  private raceNumber = 1;
  private speedIndex = 0; // starts at 1x

  // The camera: how many meters of track lie to the left of the screen edge.
  private viewLeft = 0;
  private cameraReady = false;
  private lastFrame = 0;

  // Arrow function so "this" still points at the mode when the browser calls it.
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Space") {
      e.preventDefault();
      if (this.race.state === "waiting") {
        this.race.start();
      } else if (this.race.state === "finished") {
        this.newRace();
      }
    } else if (e.code === "KeyF") {
      this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    }
  };

  private newRace(): void {
    this.race = createRace();
    this.raceNumber++;
    this.cameraReady = false;
  }

  enter(): void {
    window.addEventListener("keydown", this.onKeyDown);
    this.race = createRace();
    this.cameraReady = false;
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
    const S = width / PIXELS_PER_SCREEN_WIDTH_METER; // pixels per meter
    const u = S * 0.1; // one "pixel" of the pixel-art scenery

    // Layout: sky on top, lanes in the middle, fence along the bottom.
    const skyH = height * 0.22;
    const lanesTop = skyH;
    const lanesBottom = height * 0.86;
    const laneH = (lanesBottom - lanesTop) / count;

    this.updateCamera(width, S);
    const toX = (meters: number): number => (meters - this.viewLeft) * S;

    // Sky, grandstands and the finish pole
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, width, skyH);
    [4, race.trackLength * 0.45, race.trackLength - 11].forEach((wx, i) => {
      drawGrandstand(ctx, toX(wx), lanesTop, u, i * 7);
    });
    drawFinishPole(ctx, toX(race.trackLength), height * 0.04, lanesTop, u);

    // Grass lanes with yellow lines between them
    ctx.fillStyle = GRASS;
    ctx.fillRect(0, lanesTop, width, lanesBottom - lanesTop);
    ctx.fillStyle = LANE_LINE;
    for (let i = 0; i <= count; i++) {
      ctx.fillRect(0, lanesTop + i * laneH - 1, width, 3);
    }

    drawFence(ctx, this.viewLeft, S, width, lanesBottom, height - lanesBottom);

    // Horse names, right-aligned like in the original. Horses are drawn on top of them.
    const nameSize = clamp(Math.round(width * 0.016), 10, 26);
    ctx.font = `${nameSize}px ${PIXEL_FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    race.racers.forEach((racer, i) => {
      ctx.fillStyle = LANE_COLORS[i] ?? "#ffffff";
      ctx.fillText(racer.name, width * 0.385, lanesTop + (i + 0.5) * laneH);
    });

    // Start line and finish line across the lanes
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(toX(0) - u * 0.8, lanesTop, u * 1.6, lanesBottom - lanesTop);
    ctx.fillRect(toX(race.trackLength) - u * 0.8, lanesTop, u * 1.6, lanesBottom - lanesTop);

    // Horses, top lane first so lower lanes overlap the ones above
    race.racers.forEach((racer, i) => {
      const groundY = lanesTop + (i + 0.92) * laneH;
      drawHorse(ctx, racer.horse, -this.viewLeft * S, groundY, S, {
        color: LANE_COLORS[i] ?? "#888888",
        label: String(i + 1),
      });

      // A horse that has dropped off the left edge gets a marker saying how far behind it is.
      const metersBehind = this.viewLeft - racer.horse.torso.getPosition().x;
      if (metersBehind > 1.5) {
        this.drawBehindMarker(ctx, lanesTop + (i + 0.5) * laneH, LANE_COLORS[i] ?? "#888888", metersBehind, width);
      }
    });

    this.drawHud(ctx, width, height, lanesBottom);
    if (race.state === "finished") {
      this.drawResults(ctx, width, height);
    }
  }

  // Smoothly follows the leading horse, but never shows more than the track plus a margin.
  private updateCamera(width: number, S: number): void {
    const screenMeters = width / S;
    const minLeft = -START_AT * screenMeters;
    const maxLeft = Math.max(minLeft, this.race.trackLength - FINISH_AT * screenMeters);

    const leaderX = Math.max(...this.race.racers.map((r) => r.distance));
    const target = clamp(leaderX - LEADER_AT * screenMeters, minLeft, maxLeft);

    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;

    if (!this.cameraReady) {
      this.viewLeft = minLeft;
      this.cameraReady = true;
    } else {
      this.viewLeft += (target - this.viewLeft) * (1 - Math.exp(-dt * 4));
    }
  }

  // A little arrow on the left edge of a lane: "this horse is N meters behind the screen".
  private drawBehindMarker(
    ctx: CanvasRenderingContext2D,
    y: number,
    color: string,
    meters: number,
    width: number,
  ): void {
    const size = clamp(Math.round(width * 0.012), 8, 18);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(8 + size * 1.2, y - size * 0.8);
    ctx.lineTo(8 + size * 1.2, y + size * 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.font = `${size}px ${PIXEL_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(`${Math.round(meters)} m`, 8 + size * 1.6, y);
    ctx.fillStyle = color;
    ctx.fillText(`${Math.round(meters)} m`, 8 + size * 1.6, y);
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number, height: number, lanesBottom: number): void {
    const race = this.race;
    const small = clamp(Math.round(width * 0.011), 8, 16);
    const big = clamp(Math.round(width * 0.016), 10, 24);

    // "Race N" tag, top left
    ctx.font = `${big}px ${PIXEL_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const tag = `Race ${this.raceNumber}`;
    const tagW = ctx.measureText(tag).width + big * 1.2;
    ctx.fillStyle = "#3a8fd8cc";
    ctx.fillRect(10, 10, tagW, big * 2.2);
    ctx.fillStyle = "#e6f4ff";
    ctx.fillText(tag, 10 + big * 0.6, 10 + big * 1.1);

    // Progress strip under the race tag: one dot per horse from start to finish
    const barW = clamp(width * 0.2, 140, 380);
    const barX = 24;
    const barY = 10 + big * 2.2 + 22;
    ctx.fillStyle = "#ffffffaa";
    ctx.fillRect(barX - 10, barY - 16, barW + 20, 32);
    ctx.fillStyle = "#555555";
    ctx.fillRect(barX, barY - 2, barW, 4);
    ctx.fillRect(barX - 2, barY - 8, 4, 16);
    ctx.fillRect(barX + barW - 2, barY - 8, 4, 16);
    race.racers.forEach((racer, i) => {
      const t = clamp(racer.distance / race.trackLength, 0, 1);
      ctx.fillStyle = LANE_COLORS[i] ?? "#888888";
      ctx.beginPath();
      ctx.arc(barX + t * barW, barY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // White info panel on the fence, bottom center
    const panelW = width * 0.4;
    const panelH = (height - lanesBottom) * 0.9;
    const px = (width - panelW) / 2;
    const py = height - panelH;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px, py, panelW, panelH);

    ctx.fillStyle = "#222222";
    ctx.textAlign = "center";
    ctx.font = `${small * 1.4}px ${PIXEL_FONT}`;
    let line1: string;
    if (race.state === "waiting") {
      line1 = "SPACE to start";
    } else if (race.state === "running") {
      line1 = race.raceTime < 0 ? "Get ready..." : `Time ${race.raceTime.toFixed(1)} s`;
    } else {
      line1 = "SPACE: next race";
    }
    ctx.fillText(line1, width / 2, py + panelH * 0.36);
    ctx.font = `${small}px ${PIXEL_FONT}`;
    ctx.fillStyle = "#666666";
    ctx.fillText(`[F] speed ${SPEEDS[this.speedIndex]}x   [2] horse test`, width / 2, py + panelH * 0.74);
  }

  private drawResults(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const race = this.race;
    const small = clamp(Math.round(width * 0.012), 9, 18);
    const rowH = small * 2.4;
    const panelW = Math.min(width * 0.7, small * 40);
    const panelH = rowH * (race.results.length + 2);
    const px = (width - panelW) / 2;
    const py = height * 0.36 - panelH / 2 + height * 0.1;

    ctx.fillStyle = "#000000ee";
    ctx.fillRect(px, py, panelW, panelH);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `${small * 1.3}px ${PIXEL_FONT}`;
    ctx.fillText("Results", px + small, py + rowH);

    ctx.font = `${small}px ${PIXEL_FONT}`;
    race.results.forEach((racer, i) => {
      ctx.fillStyle = LANE_COLORS[race.racers.indexOf(racer)] ?? "#ffffff";
      ctx.fillText(`${i + 1}. ${racer.name}`, px + small, py + rowH * (i + 2));
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "right";
      ctx.fillText(this.describe(racer), px + panelW - small, py + rowH * (i + 2));
      ctx.textAlign = "left";
    });
  }

  private describe(racer: Racer): string {
    if (racer.status === "finished") return `${racer.finishTime.toFixed(2)} s`;
    if (racer.distance < -0.5) return `backward to ${racer.distance.toFixed(0)} m`;
    if (racer.isDown) return `down at ${racer.distance.toFixed(0)} m`;
    return `stopped at ${racer.distance.toFixed(0)} m`;
  }
}