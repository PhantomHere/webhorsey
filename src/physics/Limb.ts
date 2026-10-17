import type { RevoluteJoint } from "planck";

// A limb is a joint (like a hip) with a motor that tries to hold the joint at a target angle.
//
// How the "muscle" works: every physics step we compare where the joint IS with
// where it SHOULD be, and tell the motor to turn toward the target. The bigger the
// error, the faster it turns. The joint's maxMotorTorque (set when the joint is
// created) limits how hard it can push, so a weak muscle sags under load.
export class Limb {
  readonly joint: RevoluteJoint;
  targetAngle: number; // radians, relative to the torso
  private readonly stiffness: number; // how aggressively the motor chases the target

  constructor(joint: RevoluteJoint, targetAngle: number, stiffness: number) {
    this.joint = joint;
    this.targetAngle = targetAngle;
    this.stiffness = stiffness;
  }

  update(): void {
    const error = this.targetAngle - this.joint.getJointAngle();
    this.joint.setMotorSpeed(error * this.stiffness);
  }
}