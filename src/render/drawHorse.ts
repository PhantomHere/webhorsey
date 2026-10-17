import type { Part, PhysicsHorse } from "../physics/PhysicsHorse";

// Draws a horse. (originX, groundY) is the screen position of physics point (0, 0).
// scale = pixels per meter. Physics y points up, screen y points down, so y is flipped.
export function drawHorse(
  ctx: CanvasRenderingContext2D,
  horse: PhysicsHorse,
  originX: number,
  groundY: number,
  scale: number,
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
  horse.decor.forEach(drawPart); // face and tail on top
}