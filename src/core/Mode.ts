// Every game mode (race, truck map, building...) implements this interface.
// The game loop never knows which mode it is talking to; it only uses these four methods.
export interface Mode {
  // Called once each time the mode becomes the active one.
  enter(): void;

  // Called once when the game switches away from this mode.
  exit(): void;

  // dt = seconds since the previous frame. Move things by speed * dt.
  update(dt: number): void;

  // Draw the current state. width/height are the canvas size in pixels.
  render(ctx: CanvasRenderingContext2D, width: number, height: number): void;
}