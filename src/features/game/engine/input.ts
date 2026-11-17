import type { Vector2 } from "./types";

export type Direction = "up" | "left" | "down" | "right";
export type InputState = {
  analog?: Vector2;
  keys: Map<string, Direction>;
  pointers: Map<number, Direction>;
};

export function readDirection(input: InputState): Vector2 {
  const held = new Set([...input.keys.values(), ...input.pointers.values()]);
  return {
    x: Math.max(
      -1,
      Math.min(
        1,
        Number(held.has("right")) -
          Number(held.has("left")) +
          (input.analog?.x || 0),
      ),
    ),
    y: Math.max(
      -1,
      Math.min(
        1,
        Number(held.has("down")) -
          Number(held.has("up")) +
          (input.analog?.y || 0),
      ),
    ),
  };
}
