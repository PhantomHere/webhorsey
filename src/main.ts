import "./style.css";
import { ModeManager } from "./core/ModeManager";
import { RaceMode } from "./modes/RaceMode";
import { HorseTestMode } from "./modes/HorseTestMode";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

const modes = new ModeManager();
modes.register("race", new RaceMode());
modes.register("horsetest", new HorseTestMode());
modes.switchTo("race");

// Temporary shortcuts to switch modes: 1 = race, 2 = horse test.
window.addEventListener("keydown", (e) => {
  if (e.code === "Digit1") modes.switchTo("race");
  if (e.code === "Digit2") modes.switchTo("horsetest");
});

// The game loop: the browser calls frame() before every screen refresh.
let last = performance.now();
function frame(now: number): void {
  // Seconds since last frame. Clamped so a hidden tab doesn't cause a huge jump.
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  modes.update(dt);
  modes.render(ctx, canvas.width, canvas.height);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);