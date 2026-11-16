import { detectCollision } from "./collision";
import type { MapConfig, Vector2 } from "./types";

export const DEMO_SPEED = 150;
export const MAX_DELTA_SECONDS = 0.05;

export function updateMovement(
  position: Vector2,
  direction: Vector2,
  dt: number,
  map: MapConfig,
  speed = DEMO_SPEED,
): Vector2 {
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0 || dt <= 0) return position;

  const step = (speed * Math.min(dt, MAX_DELTA_SECONDS)) / length;
  const horizontal = { x: position.x + direction.x * step, y: position.y };
  const x = detectCollision(horizontal, map) ? position.x : horizontal.x;
  const vertical = { x, y: position.y + direction.y * step };
  return detectCollision(vertical, map) ? { x, y: position.y } : vertical;
}
