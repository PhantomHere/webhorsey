import type { Mode } from "./Mode";

// Holds all registered modes and keeps track of which one is active.
// The game loop calls update/render here, and they are forwarded to the active mode.
export class ModeManager {
  private modes = new Map<string, Mode>();
  private current: Mode | null = null;

  register(name: string, mode: Mode): void {
    this.modes.set(name, mode);
  }

  switchTo(name: string): void {
    const next = this.modes.get(name);
    if (!next) {
      throw new Error(`Unknown mode: ${name}`);
    }
    this.current?.exit();
    this.current = next;
    next.enter();
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.current?.render(ctx, width, height);
  }
}