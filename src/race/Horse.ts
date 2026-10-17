export interface HorseStats {
  topSpeed: number; // meters per second at full effort
  acceleration: number; // meters per second, per second
  stamina: number; // energy units; running at full speed burns 1 unit per second
  sprintStart: number; // fraction of the track (0-1) where the horse starts its final push
}

export class Horse {
  readonly name: string;
  readonly color: string;
  readonly stats: HorseStats;

  position = 0; // meters from the start
  speed = 0; // meters per second
  energy: number;
  finished = false;
  finishTime = 0;

  // "Form" is a small random multiplier that changes every second or two,
  // so identical horses don't produce identical races.
  private form = 1;
  private formTimer = 0;

  constructor(name: string, color: string, stats: HorseStats) {
    this.name = name;
    this.color = color;
    this.stats = stats;
    this.energy = stats.stamina;
  }

  update(dt: number, trackLength: number): void {
    // 1. Form: re-roll occasionally.
    this.formTimer -= dt;
    if (this.formTimer <= 0) {
      this.form = 0.96 + Math.random() * 0.08; // 0.96 - 1.04
      this.formTimer = 1 + Math.random(); // 1 - 2 seconds
    }

    // 2. Decision (the "AI"): cruise first, then sprint once past sprintStart.
    const progress = this.position / trackLength;
    const effort = progress >= this.stats.sprintStart ? 1.0 : 0.85;

    // 3. Fatigue: when energy drops below 20% of stamina, the speed cap fades
    //    from 100% down to 55%.
    const fatigue = Math.min(1, Math.max(0, this.energy / (this.stats.stamina * 0.2)));
    const fatigueCap = 0.55 + 0.45 * fatigue;

    // 4. The speed the horse is trying to reach right now.
    const targetSpeed = this.stats.topSpeed * effort * this.form * fatigueCap;

    // 5. Accelerate toward it (slowing down is a bit quicker than speeding up).
    const diff = targetSpeed - this.speed;
    const rate = diff > 0 ? this.stats.acceleration : this.stats.acceleration * 1.5;
    const maxStep = rate * dt;
    this.speed += Math.max(-maxStep, Math.min(maxStep, diff));

    // 6. Energy: burn scales with the square of relative speed,
    //    so sprinting costs far more than cruising.
    const load = this.speed / this.stats.topSpeed;
    this.energy = Math.max(0, this.energy - load * load * dt);

    // 7. Move.
    this.position += this.speed * dt;
  }
}