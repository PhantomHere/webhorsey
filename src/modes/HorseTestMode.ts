import { Edge, World } from "planck";
import type { Mode } from "../core/Mode";
import { DEFAULT_DNA, PhysicsHorse } from "../physics/PhysicsHorse";

const STEP = 1 / 60; // fixed physics step, in seconds
const PIXELS_PER_METER = 100;
const START_DELAY = 1; // seconds of standing still before the gait starts

// Test bench for the physics horse. Space resets it, P gives it a shove.
export class HorseTestMode implements Mode {
  private world = new World({ x: 0, y: -10 });
  private horse = new PhysicsHorse(this.world, 0, 0, DEFAULT_DNA);
  private accumulator = 0;
  private simTime = 0;
  private started = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Space") {
      e.preventDefault();
      this.build();
    } else if (e.code === "KeyP") {
      // Push the torso sideways to see whether the horse recovers.
      const torso = this.horse.torso;
      torso.applyLinearImpulse({ x: torso.getMass() * 2, y: 0 }, torso.getWorldCenter(), true);
    }
  };

  private build(): void {
    this.world = new World({ x: 0, y: -10 });
    const ground = this.world.createBody();
    ground.createFixture(new Edge({ x: -1000, y: 0 }, { x: 1000, y: 0 }), { friction: 1 });
    this.horse = new PhysicsHorse(this.world, 0, 0, DEFAULT_DNA);
    this.accumulator = 0;
    this.simTime = 0;
    this.started = false;
  }

  enter(): void {
    window.addEventListener("keydown", this.onKeyDown);
    this.build();
  }

  exit(): void {
    window.removeEventListener("keydown", this.onKeyDown);
  }

  update(dt: number): void {
    // Physics runs in fixed steps so it behaves the same at any frame rate.
    this.accumulator += dt;
    while (this.accumulator >= STEP) {
      this.simTime += STEP;
      if (!this.started && this.simTime >= START_DELAY) {
        this.horse.start();
        this.started = true;
      }
      this.horse.update(STEP);
      this.world.step(STEP, 8, 3);
      this.accumulator -= STEP;
    }
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const groundScreenY = height * 0.75;
    const camX = this.horse.torso.getPosition().x;
    const S = PIXELS_PER_METER;

    ctx.fillStyle = "#87b7d6";
    ctx.fillRect(0, 0, width, groundScreenY);
    ctx.fillStyle = "#5f9e4a";
    ctx.fillRect(0, groundScreenY, width, height - groundScreenY);

    // Distance markers every 2 meters, so you can see the ground moving past.
    ctx.strokeStyle = "#ffffff55";
    ctx.fillStyle = "#ffffffaa";
    ctx.font = "14px sans-serif";
    const firstMark = Math.floor((camX - width / 2 / S) / 2) * 2;
    for (let m = firstMark; m < camX + width / 2 / S + 2; m += 2) {
      const sx = width / 2 + (m - camX) * S;
      ctx.beginPath();
      ctx.moveTo(sx, groundScreenY);
      ctx.lineTo(sx, groundScreenY + 14);
      ctx.stroke();
      ctx.fillText(`${m} m`, sx - 12, groundScreenY + 32);
    }

    // World to screen: x is shifted so the camera follows the horse, y is flipped (physics y points up).
    for (const part of this.horse.parts) {
      const p = part.body.getWorldPoint({ x: part.cx, y: part.cy });
      const sx = width / 2 + (p.x - camX) * S;
      const sy = groundScreenY - p.y * S;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-(part.body.getAngle() + part.angle));
      ctx.fillStyle = part.color;
      ctx.fillRect(-part.halfW * S, -part.halfH * S, part.halfW * 2 * S, part.halfH * 2 * S);
      ctx.restore();
    }

    const tiltDeg = (this.horse.torso.getAngle() * 180) / Math.PI;
    const phases = this.horse.limbs.map((l) => l.phase).join(" / ");
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.fillText("HORSE TEST   [Space] reset   [P] shove   [1] race mode", 20, 30);
    ctx.fillText(
      `distance: ${camX.toFixed(1)} m   height: ${this.horse.torso.getPosition().y.toFixed(2)} m   tilt: ${tiltDeg.toFixed(0)}°`,
      20,
      56,
    );
    ctx.fillText(
      `${this.started ? "walking" : "standing"}   legs (front / rear): ${phases}`,
      20,
      82,
    );
  }
}