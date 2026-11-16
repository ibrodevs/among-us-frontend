import type { MapConfig, Vector2 } from "./types";

export const PLAYER_HITBOX = 28;

export function detectCollision(position: Vector2, map: MapConfig) {
  const half = PLAYER_HITBOX / 2;
  const left = position.x - half;
  const right = position.x + half;
  const top = position.y - half;
  const bottom = position.y + half;

  return left < 0 || top < 0 || right > map.width || bottom > map.height
    || map.walls.some(wall => left < wall.x + wall.width && right > wall.x
      && top < wall.y + wall.height && bottom > wall.y);
}
