import type { Mode } from "../core/Mode";
import { createRace } from "../race/createRace";
import { formatOdds, OddsCalculator, prizeFor } from "../race/odds";
import type { Odds } from "../race/odds";
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
import { loadSave, START_BANKROLL, writeSave } from "../util/save";

const SPEEDS = [1, 2, 4]; // playback speed options
const BET_CHIPS = [5, 10, 25, 50, 100]; // plus "ALL" (the whole bankroll)

// Each lane has its own color, used for the name and the numbered saddle cloth.
const LANE_COLORS = ["#e8365d", "#2ed3c0", "#c9a800", "#c43fd1", "#3a5fe0"];

// Where things sit on screen, as fractions of the screen width.
const START_AT = 0.17; // the start line when the camera is at its leftmost
const FINISH_AT = 0.77; // the finish line when the camera is at its rightmost
const LEADER_AT = 0.6; // the camera keeps the leading horse around here
const SCREEN_METERS = 20; // the screen shows about this many meters of track

// calculating: working out the odds, betting: pick a horse and an amount,
// racing: the race is on, result: the race is over and bets are paid.
type Phase = "calculating" | "betting" | "racing" | "result";

// One race together with the odds being worked out for it.
interface Round {
  race: PhysicsRace;
  odds: OddsCalculator;
}

interface Bet {
  horse: number; // lane index
  amount: number;
  odds: Odds;
}

interface Outcome {
  kind: "won" | "lost" | "refund";
  text: string;
}

interface HitArea {
  x: number;
  y: number;
  w: number;
  h: number;
  onClick: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class RaceMode implements Mode {
  private round: Round = this.makeRound();
  private nextRound: Round | null = null; // the next race, prepared while this one plays
  private phase: Phase = "calculating";
  private speedIndex = 0; // starts at 1x

  // The player
  private bankroll = START_BANKROLL;
  private raceNumber = 1;
  private selected: number | null = null; // the horse being bet on
  private betAmount = 10;
  private bet: Bet | null = null; // locked in when the race starts
  private outcome: Outcome | null = null;

  // The camera: how many meters of track lie to the left of the screen edge.
  private viewLeft = 0;
  private cameraReady = false;
  private lastFrame = 0;

  // Mouse
  private hits: HitArea[] = [];
  private mouseX = -1;
  private mouseY = -1;

  // Arrow functions so "this" still points at the mode when the browser calls them.
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Space") {
      e.preventDefault();
      this.onSpace();
    } else if (e.code === "KeyF") {
      this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    for (const hit of this.hits) {
      if (e.clientX >= hit.x && e.clientX <= hit.x + hit.w && e.clientY >= hit.y && e.clientY <= hit.y + hit.h) {
        hit.onClick();
        return;
      }
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };

  private makeRound(): Round {
    const race = createRace();
    return {
      race,
      odds: new OddsCalculator(race.racers.map((r) => r.genome), race.trackLength, race.timeLimit),
    };
  }

  enter(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);

    const save = loadSave();
    this.bankroll = save.bankroll;
    this.raceNumber = save.raceNumber;
    this.round = this.makeRound();
    this.nextRound = null;
    this.resetBetting();
  }

  exit(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    document.body.style.cursor = "default";

    // Leaving in the middle of a race gives the stake back instead of losing it.
    if (this.phase === "racing" && this.bet) {
      this.bankroll += this.bet.amount;
      this.persist();
    }
  }

  // Get ready for a fresh betting round.
  private resetBetting(): void {
    this.selected = null;
    this.bet = null;
    this.outcome = null;
    this.betAmount = Math.min(10, this.bankroll);
    this.cameraReady = false;
    this.phase = this.round.odds.done ? "betting" : "calculating";
  }

  private onSpace(): void {
    if (this.phase === "betting") {
      this.startRace();
    } else if (this.phase === "result") {
      if (this.bankroll <= 0) {
        this.bankroll = START_BANKROLL; // broke: start over
        this.raceNumber = 1;
      } else {
        this.raceNumber++;
      }
      this.round = this.nextRound ?? this.makeRound();
      this.nextRound = null;
      this.resetBetting();
      this.persist();
    }
  }

  private startRace(): void {
    const odds = this.selected === null ? undefined : this.round.odds.odds[this.selected];
    if (this.selected !== null && odds) {
      this.bet = { horse: this.selected, amount: this.betAmount, odds };
      this.bankroll -= this.betAmount; // the stake is taken now and comes back only with a win
      this.persist();
    }
    this.round.race.start();
    this.phase = "racing";
    this.nextRound = this.makeRound(); // start on the next race's odds while this one plays
  }

  // Pay out (or not) once the race is over.
  private settle(): void {
    const race = this.round.race;
    const first = race.results[0];
    const winner = first && first.status === "finished" ? race.racers.indexOf(first) : -1;

    if (this.bet) {
      const bet = this.bet;
      const name = race.racers[bet.horse]?.name ?? "your horse";
      if (winner < 0) {
        this.bankroll += bet.amount;
        this.outcome = { kind: "refund", text: `No horse finished. Your $${bet.amount} is returned.` };
      } else if (winner === bet.horse) {
        const prize = prizeFor(bet.amount, bet.odds);
        this.bankroll += prize;
        this.outcome = { kind: "won", text: `${name} won! You win $${prize - bet.amount}!` };
      } else {
        this.outcome = { kind: "lost", text: `${name} lost. You lose $${bet.amount}.` };
      }
    }
    this.persist();
    this.phase = "result";
  }

  private persist(): void {
    writeSave({ bankroll: this.bankroll, raceNumber: this.raceNumber });
  }

  update(dt: number): void {
    if (this.phase === "calculating") {
      this.round.odds.work(40);
      if (this.round.odds.done) this.phase = "betting";
    } else if (this.phase === "racing") {
      // Playback speed only changes how many fixed steps run per frame, never the outcome.
      this.round.race.update(dt * (SPEEDS[this.speedIndex] ?? 1));
      this.nextRound?.odds.work(6); // a few milliseconds per frame is enough to finish in time
      if (this.round.race.state === "finished") this.settle();
    } else if (this.phase === "result") {
      this.nextRound?.odds.work(15);
    }
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const race = this.round.race;
    const count = race.racers.length;
    const S = width / SCREEN_METERS; // pixels per meter
    const u = S * 0.1; // one "pixel" of the pixel-art scenery
    this.hits = [];

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

    if (this.phase === "betting") {
      this.drawBettingUi(ctx, width, lanesTop, lanesBottom, laneH);
    } else if (this.bet) {
      this.drawYourBetTag(ctx, width, lanesTop, laneH);
    }

    this.drawHud(ctx, width, height, lanesBottom);
    if (this.phase === "calculating") this.drawCalculating(ctx, width, height);
    if (this.phase === "result") this.drawResults(ctx, width, height);

    // Pointer cursor over anything clickable
    const hovering = this.hits.some((h) => this.isOver(h.x, h.y, h.w, h.h));
    document.body.style.cursor = hovering ? "pointer" : "default";
  }

  private isOver(x: number, y: number, w: number, h: number): boolean {
    return this.mouseX >= x && this.mouseX <= x + w && this.mouseY >= y && this.mouseY <= y + h;
  }

  // A blocky button that can be clicked.
  private button(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fontSize: number,
    colors: { fill: string; text: string; border?: string },
    onClick?: () => void,
  ): void {
    const hover = onClick !== undefined && this.isOver(x, y, w, h);
    ctx.fillStyle = colors.border ?? "#00000033";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = colors.fill;
    ctx.fillRect(x, y, w, h);
    if (hover) {
      ctx.fillStyle = "#ffffff44";
      ctx.fillRect(x, y, w, h);
    }
    ctx.fillStyle = colors.text;
    ctx.font = `${fontSize}px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2 + fontSize * 0.05);
    if (onClick) this.hits.push({ x, y, w, h, onClick });
  }

  // "Win?" buttons with odds next to every name, and the betting booth on the right.
  private drawBettingUi(
    ctx: CanvasRenderingContext2D,
    width: number,
    lanesTop: number,
    lanesBottom: number,
    laneH: number,
  ): void {
    const small = clamp(Math.round(width * 0.0105), 8, 15);
    const race = this.round.race;

    // One "Win?" button per horse, with its odds beside it
    race.racers.forEach((_, i) => {
      const odds = this.round.odds.odds[i];
      const chosen = this.selected === i;
      const bw = width * 0.085;
      const bh = laneH * 0.45;
      const bx = width * 0.4;
      const by = lanesTop + (i + 0.5) * laneH - bh / 2;
      this.button(
        ctx,
        bx,
        by,
        bw,
        bh,
        chosen ? "Win" : "Win?",
        small * 1.3,
        chosen ? { fill: "#3a5fe0", text: "#ffffff" } : { fill: "#b7b7b7", text: "#ffffff" },
        () => {
          this.selected = i;
        },
      );
      if (odds) {
        ctx.fillStyle = LANE_COLORS[i] ?? "#222222";
        ctx.font = `${small * 1.5}px ${PIXEL_FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(formatOdds(odds), bx + bw + 14, by + bh / 2);
      }
    });

    // The booth
    const bx = width * 0.7;
    const by = lanesTop + laneH * 0.15;
    const bw = width * 0.27;
    const bh = lanesBottom - lanesTop - laneH * 0.3;
    ctx.fillStyle = "#8a5a28";
    ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
    ctx.fillStyle = "#c98e4f";
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = "#ff9e86";
    ctx.fillRect(bx, by, bw, bh * 0.14);
    ctx.fillStyle = "#ffffff";
    ctx.font = `${small * 1.7}px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BETTING", bx + bw / 2, by + bh * 0.07);

    // The booth keeper's speech bubble
    const bubbleX = bx + bw * 0.06;
    const bubbleY = by + bh * 0.19;
    const bubbleW = bw * 0.88;
    const bubbleH = bh * 0.22;
    ctx.fillStyle = "#37c9c9";
    ctx.fillRect(bubbleX - 3, bubbleY - 3, bubbleW + 6, bubbleH + 6);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
    ctx.fillStyle = "#1fa5a5";
    ctx.font = `${small * 1.1}px ${PIXEL_FONT}`;
    const chosen = this.selected === null ? undefined : race.racers[this.selected];
    const chosenOdds = this.selected === null ? undefined : this.round.odds.odds[this.selected];
    if (chosen && chosenOdds) {
      ctx.fillText(chosen.name, bubbleX + bubbleW / 2, bubbleY + bubbleH * 0.35);
      ctx.fillText(`pays $${prizeFor(this.betAmount, chosenOdds)}`, bubbleX + bubbleW / 2, bubbleY + bubbleH * 0.72);
    } else {
      ctx.fillText("Pick a horse", bubbleX + bubbleW / 2, bubbleY + bubbleH * 0.35);
      ctx.fillText("to win!", bubbleX + bubbleW / 2, bubbleY + bubbleH * 0.72);
    }

    // Bet amount chips
    ctx.fillStyle = "#ffffff";
    ctx.font = `${small}px ${PIXEL_FONT}`;
    ctx.fillText("Your bet", bx + bw / 2, by + bh * 0.49);

    const chips: { label: string; value: number }[] = [
      ...BET_CHIPS.map((v) => ({ label: `$${v}`, value: v })),
      { label: "ALL", value: this.bankroll },
    ];
    const cw = bw * 0.42;
    const ch = bh * 0.12;
    chips.forEach((chip, k) => {
      const col = k % 2;
      const row = Math.floor(k / 2);
      const cx = bx + bw * 0.06 + col * (cw + bw * 0.04);
      const cy = by + bh * 0.54 + row * (ch + bh * 0.04);
      const affordable = chip.value <= this.bankroll && chip.value > 0;
      const active = this.betAmount === chip.value;
      this.button(
        ctx,
        cx,
        cy,
        cw,
        ch,
        chip.label,
        small * 1.2,
        active
          ? { fill: "#ffd84a", text: "#5a3a00", border: "#ffffff" }
          : affordable
            ? { fill: "#e9c79a", text: "#6b4420" }
            : { fill: "#a8896a", text: "#7d6448" },
        affordable
          ? () => {
              this.betAmount = chip.value;
            }
          : undefined,
      );
    });
  }

  // During the race: a small tag under the name of the horse you bet on.
  private drawYourBetTag(ctx: CanvasRenderingContext2D, width: number, lanesTop: number, laneH: number): void {
    if (!this.bet) return;
    const small = clamp(Math.round(width * 0.0105), 8, 15);
    ctx.fillStyle = LANE_COLORS[this.bet.horse] ?? "#222222";
    ctx.font = `${small}px ${PIXEL_FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `YOUR BET $${this.bet.amount} (${formatOdds(this.bet.odds)})`,
      width * 0.385,
      lanesTop + (this.bet.horse + 0.5) * laneH + small * 2.2,
    );
  }

  // Smoothly follows the leading horse, but never shows more than the track plus a margin.
  private updateCamera(width: number, S: number): void {
    const screenMeters = width / S;
    const minLeft = -START_AT * screenMeters;
    const maxLeft = Math.max(minLeft, this.round.race.trackLength - FINISH_AT * screenMeters);

    const leaderX = Math.max(...this.round.race.racers.map((r) => r.distance));
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
    const race = this.round.race;
    const small = clamp(Math.round(width * 0.011), 8, 16);
    const big = clamp(Math.round(width * 0.016), 10, 24);
    const huge = clamp(Math.round(width * 0.024), 14, 40);

    // Money, top left: green on white like the original
    ctx.font = `${huge}px ${PIXEL_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const money = `$${this.bankroll}`;
    const moneyW = ctx.measureText(money).width + huge;
    const moneyH = huge * 1.7;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(10, 10, Math.max(moneyW, huge * 6), moneyH);
    ctx.fillStyle = "#f4a63a";
    ctx.fillRect(10, 10 + moneyH - 3, Math.max(moneyW, huge * 6), 3);
    ctx.fillStyle = "#22c55e";
    ctx.fillText(money, 10 + huge * 0.5, 10 + moneyH / 2);

    // "Race N" tag
    const tagY = 10 + moneyH + 6;
    ctx.font = `${big}px ${PIXEL_FONT}`;
    const tag = `Race ${this.raceNumber}`;
    const tagW = ctx.measureText(tag).width + big * 1.2;
    ctx.fillStyle = "#3a8fd8cc";
    ctx.fillRect(10, tagY, tagW, big * 2.2);
    ctx.fillStyle = "#e6f4ff";
    ctx.fillText(tag, 10 + big * 0.6, tagY + big * 1.1);

    // Progress strip, top right: one dot per horse from start to finish
    const barW = clamp(width * 0.17, 120, 340);
    const barX = width - barW - 24;
    const barY = 10 + big * 1.1;
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

    let line1 = "";
    let line2 = `[F] speed ${SPEEDS[this.speedIndex]}x   [2] horse test`;
    const chosen = this.selected === null ? undefined : race.racers[this.selected];
    const chosenOdds = this.selected === null ? undefined : this.round.odds.odds[this.selected];

    if (this.phase === "calculating") {
      line1 = "Posting odds...";
    } else if (this.phase === "betting") {
      if (chosen && chosenOdds) {
        line1 = `odds ${formatOdds(chosenOdds)}   prize $${prizeFor(this.betAmount, chosenOdds)}`;
        line2 = "SPACE: start the race";
      } else {
        line1 = "Pick a horse to bet on";
        line2 = "or SPACE to just watch";
      }
    } else if (this.phase === "racing") {
      line1 = race.raceTime < 0 ? "Get ready..." : `Time ${race.raceTime.toFixed(1)} s`;
    } else {
      line1 = this.bankroll <= 0 ? "Broke! SPACE: restart" : "SPACE: next race";
    }

    ctx.fillStyle = "#222222";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${small * 1.4}px ${PIXEL_FONT}`;
    ctx.fillText(line1, width / 2, py + panelH * 0.36);
    ctx.font = `${small}px ${PIXEL_FONT}`;
    ctx.fillStyle = "#666666";
    ctx.fillText(line2, width / 2, py + panelH * 0.74);
  }

  private drawCalculating(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const small = clamp(Math.round(width * 0.012), 9, 18);
    const w = width * 0.36;
    const h = small * 6;
    const x = (width - w) / 2;
    const y = height * 0.45;
    ctx.fillStyle = "#000000cc";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.font = `${small * 1.2}px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Working out the odds...", width / 2, y + h * 0.32);
    ctx.fillStyle = "#ffffff44";
    ctx.fillRect(x + w * 0.08, y + h * 0.62, w * 0.84, small * 0.9);
    ctx.fillStyle = "#3ee06b";
    ctx.fillRect(x + w * 0.08, y + h * 0.62, w * 0.84 * this.round.odds.progress, small * 0.9);
  }

  private drawResults(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const race = this.round.race;
    const small = clamp(Math.round(width * 0.012), 9, 18);
    const rowH = small * 2.4;
    const rows = race.results.length + 2 + (this.outcome ? 1 : 0);
    const panelW = Math.min(width * 0.7, small * 42);
    const panelH = rowH * rows;
    const px = (width - panelW) / 2;
    const py = height * 0.46 - panelH / 2;

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

    if (this.outcome) {
      ctx.font = `${small * 1.1}px ${PIXEL_FONT}`;
      ctx.fillStyle = this.outcome.kind === "won" ? "#5df08a" : this.outcome.kind === "lost" ? "#ff7a7a" : "#ffe27a";
      ctx.textAlign = "center";
      ctx.fillText(this.outcome.text, px + panelW / 2, py + rowH * (race.results.length + 2.1));
    }
  }

  private describe(racer: Racer): string {
    if (racer.status === "finished") return `${racer.finishTime.toFixed(2)} s`;
    if (racer.distance < -0.5) return `backward to ${racer.distance.toFixed(0)} m`;
    if (racer.isDown) return `down at ${racer.distance.toFixed(0)} m`;
    return `stopped at ${racer.distance.toFixed(0)} m`;
  }
}