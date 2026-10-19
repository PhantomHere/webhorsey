import type { Part, PhysicsHorse } from "../physics/PhysicsHorse";
import { PIXEL_FONT } from "./scenery";

// A numbered saddle cloth, like the ones in the original game.
export interface Saddle {
  color: string;
  label: string;
}

// Draws a horse. (originX, groundY) is the screen position of physics point (0, 0).
// scale = pixels per meter. Physics y points up, screen y points down, so y is flipped.
export function drawHorse(
  ctx: CanvasRenderingContext2D,
  horse: PhysicsHorse,
  originX: number,
  groundY: number,
  scale: number,
  saddle?: Saddle,
): void {
  const drawPart = (part: Part): void => {
    const p = part.body.getWorldPoint({ x: part.cx, y: part.cy });
    ctx.save();
    ctx.translate(originX + p.x * scale, groundY - p.y * scale);
    ctx.rotate(-(part.body.getAngle() + part.angle));
    ctx.fillStyle = part.color;
    ctx.fillRect(-part.halfW * scale, -part.halfH * scale, part.halfW * 2 * scale, part.halfH * 2 * scale);
    ctx.restore();
  };

  horse.parts.forEach(drawPart);

  if (saddle) {
    const size = 0.55 * scale;
    const p = horse.torso.getWorldPoint({ x: 0.1, y: 0.12 });
    ctx.save();
    ctx.translate(originX + p.x * scale, groundY - p.y * scale);
    ctx.rotate(-horse.torso.getAngle());
    ctx.fillStyle = saddle.color;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.round(size * 0.62)}px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(saddle.label, 0, size * 0.04);
    ctx.restore();
  }

  horse.decor.forEach(drawPart); // face, tail and hooves on top
}