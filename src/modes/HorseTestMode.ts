import { Edge, World } from "planck";
import type { Mode } from "../core/Mode";
import { drawHorse } from "../render/drawHorse";
import { decodeGenome, randomGenome } from "../genome/Genome";
import type { Genome } from "../genome/Genome";
import { PhysicsHorse } from "../physics/PhysicsHorse";
import type { HorseDna } from "../physics/PhysicsHorse";

const STEP = 1 / 60; // fixed physics step, in seconds
const GAIT_START_STEP = 60; // the gait starts after one second of standing
const PIXELS_PER_METER = 100;

// Test bench for one horse. Space = new random horse, R = replay the same horse, P = shove.
export class HorseTestMode implements Mode {
  private genome: Genome = randomGenome();
  private dna: HorseDna = decodeGenome(this.genome);
  private world = new World({ x: 0, y: -10 });
  private horse = new PhysicsHorse(this.world, 0, 0, this.dna);
  private accumulator = 0;
  private stepCount = 0;

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Space") {
      e.preventDefault();
      this.genome = randomGenome();
      this.build();
    } else if (e.code === "KeyR") {
      this.build();
    } else if (e.code === "KeyP") {
      // Push the torso sideways to see whether the horse recovers.
      const torso = this.horse.torso;
      torso.applyLinearImpulse({ x: torso.getMass() * 2, y: 0 }, torso.getWorldCenter(), true);
    }
  };

  private build(): void {
    this.dna = decodeGenome(this.genome);
    this.world = new World({ x: 0, y: -10 });
    const ground = this.world.createBody();
    ground.createFixture(new Edge({ x: -1000, y: 0 }, { x: 1000, y: 0 }), { friction: 1 });
    this.horse = new PhysicsHorse(this.world, 0, 0, this.dna);
    this.accumulator = 0;
    this.stepCount = 0;
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
    // The gait starts on an exact step number, so the same genome always plays out the same way.
    this.accumulator += dt;
    while (this.accumulator >= STEP) {
      if (this.stepCount === GAIT_START_STEP) {
        this.horse.start();
      }
      this.horse.update(STEP);
      this.world.step(STEP, 8, 3);
      this.stepCount++;
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

    // The camera follows the horse: shift x so the horse stays in the middle of the screen.
    drawHorse(ctx, this.horse, width / 2 - camX * S, groundScreenY, S);

    const tiltDeg = (this.horse.torso.getAngle() * 180) / Math.PI;
    const phases = this.horse.limbs.map((l) => l.phase).join(" / ");
    const d = this.dna;
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.fillText("HORSE TEST   [Space] new horse   [R] replay   [P] shove   [1] race mode", 20, 30);
    ctx.fillText(
      `distance: ${camX.toFixed(1)} m   height: ${this.horse.torso.getPosition().y.toFixed(2)} m   tilt: ${tiltDeg.toFixed(0)}°   legs: ${phases}`,
      20,
      56,
    );
    ctx.fillText(
      `leg ${d.legLength.toFixed(2)} m   muscle ${d.muscle.toFixed(2)}   swing ${d.hipSwing.toFixed(2)}   knee ${d.kneeBend.toFixed(2)}   stance ${d.stance.toFixed(2)}   stiffness ${d.stiffness.toFixed(1)}`,
      20,
      82,
    );
  }
}