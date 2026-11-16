import type { Vector2 } from "./types";

export type Direction = "up" | "left" | "down" | "right";
export type InputState = {
  keys: Map<string, Direction>;
  pointers: Map<number, Direction>;
};

export function readDirection(input: InputState): Vector2 {
  const held = new Set([...input.keys.values(), ...input.pointers.values()]);
  return {
    x: Number(held.has("right")) - Number(held.has("left")),
    y: Number(held.has("down")) - Number(held.has("up")),
  };
}
