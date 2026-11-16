import type { MapConfig, Vector2 } from "./types";

export function calculateCamera(target: Vector2, viewport: { width: number; height: number }, map: MapConfig) {
  const minimumScale = viewport.width < 700 ? 0.64 : 0.59;
  const scale = Math.max(viewport.width / map.width, viewport.height / map.height, minimumScale);
  const viewWidth = Math.min(map.width, viewport.width / scale);
  const viewHeight = Math.min(map.height, viewport.height / scale);
  return {
    scale,
    x: Math.min(map.width - viewWidth, Math.max(0, target.x - viewWidth / 2)),
    y: Math.min(map.height - viewHeight, Math.max(0, target.y - viewHeight / 2)),
  };
}
