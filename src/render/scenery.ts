// Background scenery for the race screen, drawn from plain rectangles in a pixel-art style.

export const PIXEL_FONT = '"Press Start 2P", monospace';
export const SKY = "#85d8ff";
export const GRASS = "#b4ff78";
export const LANE_LINE = "#ece66a";
const FENCE = "#d9766a";
const CROWD = ["#ff5d7a", "#ffd24a", "#5ad1c4", "#6f8cff", "#ff9d5c", "#9be15d", "#d98cff"];

// A small deterministic hash, so the crowd always has the same colors.
function hash(a: number, b: number, c: number): number {
  return ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0;
}

// A grandstand with towers, flags and a colorful crowd. x = left edge, baseY = bottom edge,
// u = one "pixel" in screen pixels. It is 56 pixels wide.
export function drawGrandstand(ctx: CanvasRenderingContext2D, x: number, baseY: number, u: number, seed: number): void {
  // Towers (behind everything else)
  for (const tx of [14, 36]) {
    ctx.fillStyle = "#b9b9b9";
    ctx.fillRect(x + tx * u, baseY - 27 * u, 7 * u, 9 * u);
    ctx.fillStyle = "#f2f2f2";
    ctx.beginPath();
    ctx.moveTo(x + (tx - 1) * u, baseY - 27 * u);
    ctx.lineTo(x + (tx + 3.5) * u, baseY - 33 * u);
    ctx.lineTo(x + (tx + 8) * u, baseY - 27 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9a9a9a";
    ctx.fillRect(x + (tx + 3.2) * u, baseY - 39 * u, 0.7 * u, 6 * u); // flag pole
    ctx.fillStyle = CROWD[hash(seed, tx, 1) % CROWD.length] ?? "#ff5d7a";
    ctx.fillRect(x + (tx + 3.9) * u, baseY - 39 * u, 3 * u, 2 * u); // flag
  }

  // Roof band and base strip
  ctx.fillStyle = "#b9b9b9";
  ctx.fillRect(x, baseY - 19 * u, 56 * u, 4 * u);
  ctx.fillRect(x, baseY - 4 * u, 56 * u, 4 * u);
  ctx.fillStyle = "#f2f2f2";
  for (let k = 0; k < 13; k++) {
    ctx.fillRect(x + (2 + k * 4.2) * u, baseY - 2.5 * u, 2 * u, 1 * u);
  }

  // Three seating blocks full of people
  for (let b = 0; b < 3; b++) {
    const bx = x + (2 + b * 18) * u;
    const by = baseY - 15 * u;
    ctx.fillStyle = "#e9e9e9";
    ctx.fillRect(bx, by, 16 * u, 11 * u);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 7; c++) {
        ctx.fillStyle = CROWD[hash(seed + b, r, c) % CROWD.length] ?? "#ff5d7a";
        ctx.fillRect(bx + (1 + c * 2.1) * u, by + (1 + r * 2.4) * u, 1.6 * u, 1.6 * u);
      }
    }
  }
}

// The finish pole: a tall white post with a pink ring on top. (x, bottomY) is its foot.
export function drawFinishPole(ctx: CanvasRenderingContext2D, x: number, topY: number, bottomY: number, u: number): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 0.8 * u, topY, 1.6 * u, bottomY - topY);
  ctx.beginPath();
  ctx.arc(x, topY, 3.6 * u, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 1.5 * u;
  ctx.strokeStyle = "#ff9ea6";
  ctx.stroke();
}

// A wooden fence along the bottom edge that scrolls with the camera.
export function drawFence(
  ctx: CanvasRenderingContext2D,
  viewLeft: number,
  scale: number,
  width: number,
  y: number,
  h: number,
): void {
  ctx.fillStyle = "#9be860";
  ctx.fillRect(0, y, width, h);

  const rail = Math.max(3, h * 0.08);
  ctx.fillStyle = FENCE;
  ctx.fillRect(0, y + h * 0.22, width, rail);
  ctx.fillRect(0, y + h * 0.5, width, rail);

  const postW = Math.max(6, scale * 0.12);
  const first = Math.floor(viewLeft / 3) * 3;
  for (let m = first; (m - viewLeft) * scale < width + 20; m += 3) {
    ctx.fillRect((m - viewLeft) * scale - postW / 2, y + h * 0.08, postW, h * 0.7);
  }
}