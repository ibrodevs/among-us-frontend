export type Vector2 = { x: number; y: number };
export type Rect = Vector2 & { width: number; height: number };
export type GamePhase = "demo" | "paused";

export type PlayerVisualState = {
  id: string;
  position: Vector2;
  color: string;
  facing: -1 | 1;
  moving: boolean;
  label: string;
};

export type Zone = {
  id: string;
  name: string;
  bounds: Rect;
  color: string;
  floor: string;
};

export type MapConfig = {
  width: number;
  height: number;
  zones: readonly Zone[];
  corridors: readonly Rect[];
  walls: readonly Rect[];
  spawnPoints: readonly Vector2[];
  taskPoints: readonly { id: string; title: string; position: Vector2 }[];
};
