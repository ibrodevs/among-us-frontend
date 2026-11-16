import sharedMap from "./map.json";
import type { MapConfig, PlayerVisualState, Rect, Vector2 } from "./types";

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

export const mapConfig: MapConfig = {
  width: 1600,
  height: 900,
  zones: [
    { id: "nav", name: "Навигация", bounds: rect(126, 94, 574, 284), color: "#1cb0f6", floor: "#042c60" },
    { id: "comms", name: "Связь", bounds: rect(900, 94, 574, 284), color: "#ffffff", floor: "#3c3c3c" },
    { id: "engine", name: "Двигатели", bounds: rect(126, 522, 574, 284), color: "#d7ffb8", floor: "#3c3c3c" },
    { id: "med", name: "Медблок", bounds: rect(900, 522, 574, 284), color: "#d7ffb8", floor: "#3c3c3c" },
  ],
  corridors: [rect(374, 378, 116, 144), rect(1110, 378, 116, 144), rect(490, 398, 620, 104)],
  walls: sharedMap.walls,
  spawnPoints: [
    { x: 434, y: 294 }, { x: 1166, y: 314 }, { x: 435, y: 668 }, { x: 1166, y: 674 },
  ],
  taskPoints: [
    { id: "course", title: "Проложить курс", position: { x: 568, y: 279 } },
    { id: "signal", title: "Настроить сигнал", position: { x: 1067, y: 294 } },
    { id: "power", title: "Проверить реактор", position: { x: 357, y: 676 } },
    { id: "scan", title: "Запустить сканер", position: { x: 1238, y: 670 } },
  ],
};

export const demoCrew: readonly PlayerVisualState[] = [
  { id: "comms", position: mapConfig.spawnPoints[1], color: "#ffffff", facing: -1, moving: false, label: "Демо" },
  { id: "engine", position: mapConfig.spawnPoints[2], color: "#a5ed6e", facing: 1, moving: false, label: "Демо" },
  { id: "med", position: mapConfig.spawnPoints[3], color: "#1cb0f6", facing: -1, moving: false, label: "Демо" },
];

export function contains(rectangle: Rect, point: Vector2) {
  return point.x >= rectangle.x && point.x < rectangle.x + rectangle.width
    && point.y >= rectangle.y && point.y < rectangle.y + rectangle.height;
}
