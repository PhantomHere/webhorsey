import { Box, RevoluteJoint } from "planck";
import type { Body, World } from "planck";
import { Limb } from "./Limb";
import type { LimbSignals } from "./Limb";
import { SignalBus } from "./SignalBus";

// The numbers that describe a horse's body and gait. Later these will come from a genome.
export interface HorseDna {
  torsoLength: number; // meters
  torsoHeight: number; // meters
  legLength: number; // meters (upper + lower leg)
  legThickness: number; // meters
  stance: number; // radians: standing pose, front leg tilts forward, rear leg back
  muscle: number; // multiplier for how much torque the joints can produce
  hipSwing: number; // radians the hip swings each way while moving
  kneeBend: number; // radians the knee folds during the recovery stroke
  stiffness: number; // how fast the joint motors chase their targets (gait speed)
  hue: number; // body color, 0-360 (cosmetic)
  earSize: number; // ear height in meters (cosmetic)
  tailLength: number; // tail length in meters (cosmetic)
  coatLight: number; // coat lightness in percent (cosmetic)
}

export const DEFAULT_DNA: HorseDna = {
  torsoLength: 2.0,
  torsoHeight: 0.8,
  legLength: 1.2,
  legThickness: 0.14,
  stance: 0.15,
  muscle: 2.0,
  hipSwing: 0.25,
  kneeBend: 0.6,
  stiffness: 12,
  hue: 25,
  earSize: 0.2,
  tailLength: 0.7,
  coatLight: 50,
};

// Signal wiring for a two-legged gait. Chain of events:
//   front power stroke + rear recovery start together,
//   each finish triggers the other leg's opposite phase, and the cycle repeats.
const FRONT_SIGNALS: LimbSignals = { ftobReact: 4, ftobEvent: 1, btofReact: 2, btofEvent: 3 };
const REAR_SIGNALS: LimbSignals = { ftobReact: 1, ftobEvent: 4, btofReact: 3, btofEvent: 2 };

const hsl = (h: number, s: number, l: number): string => `hsl(${h.toFixed(0)}, ${s}%, ${l}%)`;

// Balance aid: resistance to spinning, applied to the torso. Without it most horses flip over.
// (Measured over 250 random horses: it cut falls and made horses faster.)
export const TUNING = {
  angularDamping: 20,
};

const DENSITY = 40; // kg per square meter (the world is 2D)
const NO_SELF_COLLISION = -1; // fixtures that share a negative group never collide

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

export class PhysicsHorse {
  readonly torso: Body;
  readonly parts: Part[] = []; // the physical pieces
  // Cosmetic pieces (ears, eye, mouth, tail). They have no fixture, so no mass and no collisions:
  // they are only drawn, and can never change how a horse races.
  readonly decor: Part[] = [];
  readonly limbs: Limb[] = [];
  private readonly bodies: Body[] = [];
  private readonly bus = new SignalBus();

  constructor(world: World, x: number, groundY: number, dna: HorseDna) {
    const { torsoLength, torsoHeight, legLength, stance, muscle } = dna;

    // Start with the feet just above the ground (the leg tilt shortens its reach a bit).
    const hipY = groundY + legLength * Math.cos(stance) + 0.02;
    const torsoY = hipY + torsoHeight / 2;

    // --- Torso (also carries a simple rigid neck and head for now) ---
    this.torso = world.createBody({ type: "dynamic", position: { x, y: torsoY } });
    this.bodies.push(this.torso);
    this.torso.setAngularDamping(TUNING.angularDamping);
    this.addBox(this.torso, torsoLength / 2, torsoHeight / 2, 0, 0, 0, hsl(dna.hue, 62, dna.coatLight));
    this.addBox(this.torso, 0.1, 0.45, torsoLength / 2 - 0.1, torsoHeight / 2 + 0.3, -0.5, hsl(dna.hue, 62, dna.coatLight));
    this.addBox(this.torso, 0.3, 0.14, torsoLength / 2 + 0.35, torsoHeight / 2 + 0.6, -0.2, hsl(dna.hue, 62, dna.coatLight - 6));
    this.addFace(dna);
    this.addTail(dna);

    // --- Two legs: one near the front of the torso, one near the rear ---
    const hipOffset = torsoLength / 2 - 0.2;
    this.addLeg(world, x + hipOffset, hipY, stance, dna, FRONT_SIGNALS);
    this.addLeg(world, x - hipOffset, hipY, -stance, dna, REAR_SIGNALS);

    // Muscle strength scales with the horse's weight, so a heavier horse isn't automatically weaker.
    let totalMass = 0;
    for (const body of this.bodies) totalMass += body.getMass();
    const hipTorque = muscle * totalMass * 10 * legLength * 0.5;
    for (const limb of this.limbs) {
      limb.hip.setMaxMotorTorque(hipTorque);
      limb.knee.setMaxMotorTorque(hipTorque * 0.6);
    }
  }

  // Eye, nostril, mouth, muzzle and ears, placed relative to the head box.
  private addFace(dna: HorseDna): void {
    const headX = dna.torsoLength / 2 + 0.35;
    const headY = dna.torsoHeight / 2 + 0.6;
    const headAngle = -0.2;
    const cos = Math.cos(headAngle);
    const sin = Math.sin(headAngle);

    // (dx, dy) is a position on the head, in head units; this converts it to torso coordinates.
    const onHead = (dx: number, dy: number): { x: number; y: number } => ({
      x: headX + dx * cos - dy * sin,
      y: headY + dx * sin + dy * cos,
    });
    const add = (halfW: number, halfH: number, dx: number, dy: number, tilt: number, color: string): void => {
      const pos = onHead(dx, dy);
      this.decor.push({ body: this.torso, halfW, halfH, cx: pos.x, cy: pos.y, angle: headAngle + tilt, color });
    };

    add(0.1, 0.15, 0.2, -0.01, 0, hsl(dna.hue, 62, dna.coatLight - 3)); // muzzle
    add(0.015, 0.022, 0.27, 0.05, 0, "#1a1008"); // nostril
    add(0.085, 0.008, 0.2, -0.07, 0, "#1a1008"); // mouth
    add(0.035, 0.035, 0.0, 0.05, 0, "#ffffff"); // eye white
    add(0.02, 0.02, 0.01, 0.05, 0, "#4a4ae0"); // pupil
    const earBase = 0.14 + dna.earSize / 2 - 0.02;
    add(0.04, dna.earSize / 2, -0.12, earBase, 0.25, hsl(dna.hue, 55, dna.coatLight - 20)); // far ear
    add(0.045, dna.earSize / 2, -0.2, earBase, 0.1, hsl(dna.hue, 55, dna.coatLight - 14)); // near ear
  }

  // A drooping two-piece tail hanging from the rear of the torso.
  private addTail(dna: HorseDna): void {
    let anchorX = -dna.torsoLength / 2;
    let anchorY = dna.torsoHeight / 2 - 0.1;
    const segment = dna.tailLength / 2;
    const angles = [-0.5, -0.9]; // each piece droops a bit more than the last
    for (const a of angles) {
      this.decor.push({
        body: this.torso,
        halfW: 0.05,
        halfH: segment / 2,
        cx: anchorX + (segment / 2) * Math.sin(a),
        cy: anchorY - (segment / 2) * Math.cos(a),
        angle: a,
        color: hsl(dna.hue, 55, dna.coatLight - 24),
      });
      anchorX += segment * Math.sin(a);
      anchorY -= segment * Math.cos(a);
    }
  }

  private addLeg(
    world: World,
    hipX: number,
    hipY: number,
    angle: number,
    dna: HorseDna,
    signals: LimbSignals,
  ): void {
    const { legLength, legThickness } = dna;
    const segment = legLength / 2;

    // Upper leg: its origin sits at the hip, so rotating the body swings the leg around the hip.
    const upper = world.createBody({ type: "dynamic", position: { x: hipX, y: hipY }, angle });
    this.bodies.push(upper);
    this.addBox(upper, legThickness / 2, segment / 2, 0, -segment / 2, 0, hsl(dna.hue, 52, dna.coatLight + 8), 0.6);

    // Lower leg: its origin sits at the knee, which is at the end of the upper leg.
    const kneeX = hipX + segment * Math.sin(angle);
    const kneeY = hipY - segment * Math.cos(angle);
    const lower = world.createBody({ type: "dynamic", position: { x: kneeX, y: kneeY }, angle });
    this.bodies.push(lower);
    this.addBox(lower, legThickness / 2, segment / 2, 0, -segment / 2, 0, hsl(dna.hue, 52, dna.coatLight + 8), 1.0);
    // A dark hoof at the bottom of the leg. Drawn only: no physics, so it changes nothing about the race.
    this.decor.push({
      body: lower,
      halfW: legThickness * 0.7,
      halfH: 0.07,
      cx: 0,
      cy: -segment + 0.07,
      angle: 0,
      color: "#3b2412",
    });

    const hip = world.createJoint(
      new RevoluteJoint(
        { enableLimit: true, lowerAngle: -0.9, upperAngle: 0.9, enableMotor: true, maxMotorTorque: 100, motorSpeed: 0 },
        this.torso,
        upper,
        { x: hipX, y: hipY },
      ),
    );
    // The knee only bends one way: the foot folds backward (negative angle).
    const knee = world.createJoint(
      new RevoluteJoint(
        { enableLimit: true, lowerAngle: -1.8, upperAngle: 0.05, enableMotor: true, maxMotorTorque: 100, motorSpeed: 0 },
        upper,
        lower,
        { x: kneeX, y: kneeY },
      ),
    );
    if (!hip || !knee) {
      throw new Error("Could not create leg joints");
    }

    this.limbs.push(new Limb(hip, knee, angle, signals, dna.hipSwing, dna.kneeBend, dna.stiffness));
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
      density: DENSITY,
      friction,
      filterGroupIndex: NO_SELF_COLLISION,
    });
    this.parts.push({ body, halfW, halfH, cx, cy, angle, color });
  }

  // Kick off the gait. Stands in for the neck's "master clock" until the neck is a real limb.
  start(): void {
    this.bus.emit(3);
    this.bus.emit(4);
  }

  // Pull up: every limb goes back to the standing pose and the body slows to a halt.
  // Used when a horse crosses the finish line.
  stop(): void {
    for (const limb of this.limbs) {
      limb.rest();
    }
    for (const body of this.bodies) {
      body.setLinearDamping(3);
    }
  }

  update(dt: number): void {
    this.bus.tick();
    for (const limb of this.limbs) {
      limb.update(this.bus, dt);
    }
  }
}