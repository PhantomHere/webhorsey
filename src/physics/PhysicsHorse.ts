import { Box, RevoluteJoint } from "planck";
import type { Body, World } from "planck";
import { Limb } from "./Limb";

// The numbers that describe a horse's body. Later these will come from a genome.
export interface HorseDna {
  torsoLength: number; // meters
  torsoHeight: number; // meters
  legLength: number; // meters
  legThickness: number; // meters
  stance: number; // radians: front leg tilts forward, rear leg tilts back
  muscle: number; // multiplier for how much torque the joints can produce
}

export const DEFAULT_DNA: HorseDna = {
  torsoLength: 2.0,
  torsoHeight: 0.8,
  legLength: 1.2,
  legThickness: 0.14,
  stance: 0.15,
  muscle: 1.0,
};

// One box-shaped piece of the horse, kept so the renderer knows what to draw.
// (cx, cy, angle) place the box relative to its body.
export interface Part {
  body: Body;
  halfW: number;
  halfH: number;
  cx: number;
  cy: number;
  angle: number;
  color: string;
}

const NO_SELF_COLLISION = -1; // fixtures that share a negative group never collide

export class PhysicsHorse {
  readonly torso: Body;
  readonly parts: Part[] = [];
  readonly limbs: Limb[] = [];

  constructor(world: World, x: number, groundY: number, dna: HorseDna) {
    const { torsoLength, torsoHeight, legLength, legThickness, stance, muscle } = dna;

    // Start with the feet just above the ground (the leg tilt shortens its reach a bit).
    const hipY = groundY + legLength * Math.cos(stance) + 0.02;
    const torsoY = hipY + torsoHeight / 2;

    // --- Torso (also carries a simple rigid neck and head for now) ---
    this.torso = world.createBody({ type: "dynamic", position: { x, y: torsoY } });
    this.addBox(this.torso, torsoLength / 2, torsoHeight / 2, 0, 0, 0, "#c47a3a");
    // neck: a tilted box rising from the front of the torso
    this.addBox(this.torso, 0.1, 0.45, torsoLength / 2 - 0.1, torsoHeight / 2 + 0.3, -0.5, "#c47a3a");
    // head
    this.addBox(this.torso, 0.3, 0.14, torsoLength / 2 + 0.35, torsoHeight / 2 + 0.6, -0.2, "#a8642c");

    // --- Two legs: one near the front of the torso, one near the rear ---
    const hipOffset = torsoLength / 2 - 0.2;
    const torque = muscle * 60;
    this.addLeg(world, x + hipOffset, hipY, stance, legLength, legThickness, torque);
    this.addLeg(world, x - hipOffset, hipY, -stance, legLength, legThickness, torque);
  }

  private addLeg(
    world: World,
    hipX: number,
    hipY: number,
    angle: number,
    length: number,
    thickness: number,
    torque: number,
  ): void {
    // The leg body's origin sits at the hip, so rotating the body swings the leg around the hip.
    const leg = world.createBody({ type: "dynamic", position: { x: hipX, y: hipY }, angle });
    this.addBox(leg, thickness / 2, length / 2, 0, -length / 2, 0, "#7a4a22", 1.0);

    const joint = world.createJoint(
      new RevoluteJoint(
        {
          enableLimit: true,
          lowerAngle: -0.9,
          upperAngle: 0.9,
          enableMotor: true,
          maxMotorTorque: torque,
          motorSpeed: 0,
        },
        this.torso,
        leg,
        { x: hipX, y: hipY },
      ),
    );
    if (!joint) {
      throw new Error("Could not create hip joint");
    }

    this.limbs.push(new Limb(joint, angle, 12));
  }

  private addBox(
    body: Body,
    halfW: number,
    halfH: number,
    cx: number,
    cy: number,
    angle: number,
    color: string,
    friction = 0.6,
  ): void {
    body.createFixture(new Box(halfW, halfH, { x: cx, y: cy }, angle), {
      density: 1,
      friction,
      filterGroupIndex: NO_SELF_COLLISION,
    });
    this.parts.push({ body, halfW, halfH, cx, cy, angle, color });
  }

  update(): void {
    for (const limb of this.limbs) {
      limb.update();
    }
  }
}