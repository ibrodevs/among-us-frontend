import type { MapConfig, PlayerVisualState, Rect, Vector2 } from "./types";

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

export const mapConfig: MapConfig = {
  width: 1600,
  height: 900,
  zones: [
    { id: "nav", name: "Навигация", bounds: rect(126, 94, 574, 284), color: "#78d9ff", floor: "#24466c" },
    { id: "comms", name: "Связь", bounds: rect(900, 94, 574, 284), color: "#c6aaff", floor: "#3a335b" },
    { id: "engine", name: "Двигатели", bounds: rect(126, 522, 574, 284), color: "#ffb777", floor: "#483e48" },
    { id: "med", name: "Медблок", bounds: rect(900, 522, 574, 284), color: "#86e7c7", floor: "#235059" },
  ],
  corridors: [rect(374, 378, 116, 144), rect(1110, 378, 116, 144), rect(490, 398, 620, 104)],
  walls: [
    // Vacuum between and around rooms.
    rect(0, 0, 1600, 94), rect(0, 806, 1600, 94),
    rect(0, 94, 126, 712), rect(1474, 94, 126, 712),
    rect(700, 94, 200, 304), rect(700, 502, 200, 304),
    rect(126, 378, 248, 144), rect(1226, 378, 248, 144),
    rect(490, 378, 210, 20), rect(900, 378, 210, 20),
    rect(490, 502, 210, 20), rect(900, 502, 210, 20),
    // Equipment footprints. The scenery renderer uses these same rectangles.
    rect(189, 196, 145, 99), rect(511, 196, 123, 62),
    rect(1004, 202, 126, 70), rect(1252, 187, 150, 110),
    rect(180, 619, 157, 118), rect(532, 642, 111, 70),
    rect(975, 645, 133, 85), rect(1260, 615, 135, 110),
  ],
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
  { id: "comms", position: mapConfig.spawnPoints[1], color: "#c599fc", facing: -1, moving: false, label: "Демо" },
  { id: "engine", position: mapConfig.spawnPoints[2], color: "#ffc46e", facing: 1, moving: false, label: "Демо" },
  { id: "med", position: mapConfig.spawnPoints[3], color: "#63d8f8", facing: -1, moving: false, label: "Демо" },
];

export function contains(rectangle: Rect, point: Vector2) {
  return point.x >= rectangle.x && point.x < rectangle.x + rectangle.width
    && point.y >= rectangle.y && point.y < rectangle.y + rectangle.height;
}
