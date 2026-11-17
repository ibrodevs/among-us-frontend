import { useEffect, useRef } from "react";
import type { Direction, InputState } from "../engine/input";

const directionByKey: Partial<Record<string, Direction>> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyA: "left",
  ArrowLeft: "left",
  KeyS: "down",
  ArrowDown: "down",
  KeyD: "right",
  ArrowRight: "right",
};

export function useGameInput(paused: boolean, togglePause: () => void) {
  const input = useRef<InputState>({ keys: new Map(), pointers: new Map() });

  useEffect(() => {
    const state = input.current;
    function clear() {
      state.analog = { x: 0, y: 0 };
      state.keys.clear();
      state.pointers.clear();
    }
    function keydown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape" && !event.repeat) {
        togglePause();
        return;
      }
      if (event.target instanceof HTMLElement &&
          (event.target.closest("input, textarea, select") || event.target.isContentEditable)) return;
      const direction = directionByKey[event.code];
      if (!direction || paused) return;
      event.preventDefault();
      if (!event.repeat) state.keys.set(event.code, direction);
    }
    function keyup(event: KeyboardEvent) {
      state.keys.delete(event.code);
    }
    clear();
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      clear();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [paused, togglePause]);

  return input;
}
