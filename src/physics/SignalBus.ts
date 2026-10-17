// The "air" between limbs. A limb that finishes a phase emits a number here.
// Every limb can hear the numbers emitted during the previous physics step.
export class SignalBus {
  private heard = new Set<number>();
  private pending = new Set<number>();

  emit(signal: number): void {
    this.pending.add(signal);
  }

  hears(signal: number): boolean {
    return this.heard.has(signal);
  }

  // Call once per physics step: what was emitted becomes what can be heard.
  tick(): void {
    this.heard = this.pending;
    this.pending = new Set<number>();
  }
}