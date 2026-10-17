import type { RevoluteJoint } from "planck";
import type { SignalBus } from "./SignalBus";

export type Phase = "idle" | "ftob" | "btof";

// The four numbers that wire a limb into the gait chain.
// react = the signal that makes this limb start the phase.
// event = the signal this limb broadcasts when it finishes the phase.
export interface LimbSignals {
  ftobReact: number;
  ftobEvent: number;
  btofReact: number;
  btofEvent: number;
}

const REACH_TOLERANCE = 0.08; // radians: "close enough" to count a phase as complete
const MAX_PHASE_TIME = 0.5; // seconds: give up waiting for the joint after this long

// A limb = hip joint + knee joint + a small state machine.
//
//   FTOB (front-to-back): the power stroke. The leg is straight and sweeps backward
//   while touching the ground, which pushes the body forward.
//   BTOF (back-to-front): the recovery stroke. The knee bends so the foot lifts,
//   and the leg swings forward, ready for the next power stroke.
//
// When a phase finishes the limb broadcasts its event signal. Any limb whose react
// value matches starts its own phase. The gait comes from how the numbers are wired.
export class Limb {
  readonly hip: RevoluteJoint;
  readonly knee: RevoluteJoint;
  phase: Phase = "idle";

  private readonly signals: LimbSignals;
  private readonly hipSwing: number; // how far the hip swings each way (radians)
  private readonly kneeBend: number; // how far the knee folds during recovery (radians)
  private readonly stiffness: number; // how aggressively the motors chase their targets
  private hipTarget: number;
  private kneeTarget = 0;
  private phaseTime = 0;
  private queued: Phase | null = null; // a signal heard while busy waits here

  constructor(
    hip: RevoluteJoint,
    knee: RevoluteJoint,
    restAngle: number,
    signals: LimbSignals,
    hipSwing: number,
    kneeBend: number,
    stiffness: number,
  ) {
    this.hip = hip;
    this.knee = knee;
    this.hipTarget = restAngle; // until told otherwise, just hold the standing pose
    this.signals = signals;
    this.hipSwing = hipSwing;
    this.kneeBend = kneeBend;
    this.stiffness = stiffness;
  }

  update(bus: SignalBus, dt: number): void {
    // 1. Listen.
    if (bus.hears(this.signals.ftobReact)) {
      this.queued = "ftob";
    } else if (bus.hears(this.signals.btofReact)) {
      this.queued = "btof";
    }

    // 2. Is the current phase finished?
    if (this.phase !== "idle") {
      this.phaseTime += dt;
      const reached = Math.abs(this.hip.getJointAngle() - this.hipTarget) < REACH_TOLERANCE;
      if (reached || this.phaseTime > MAX_PHASE_TIME) {
        bus.emit(this.phase === "ftob" ? this.signals.ftobEvent : this.signals.btofEvent);
        this.phase = "idle";
      }
    }

    // 3. Start the next phase if one is waiting.
    if (this.phase === "idle" && this.queued) {
      this.begin(this.queued);
      this.queued = null;
    }

    // 4. Drive both joints toward their targets.
    this.hip.setMotorSpeed((this.hipTarget - this.hip.getJointAngle()) * this.stiffness);
    this.knee.setMotorSpeed((this.kneeTarget - this.knee.getJointAngle()) * this.stiffness);
  }

  private begin(phase: Phase): void {
    this.phase = phase;
    this.phaseTime = 0;
    if (phase === "ftob") {
      this.hipTarget = -this.hipSwing; // foot sweeps backward
      this.kneeTarget = 0; // leg straight
    } else {
      this.hipTarget = this.hipSwing; // foot swings forward
      this.kneeTarget = -this.kneeBend; // knee folds, foot lifts
    }
  }
}