"use client";
import { useEffect, useState, type PointerEvent, type RefObject } from "react";
import type { InputState } from "../engine/input";
export function Joystick({
  input,
  paused,
}: {
  input: RefObject<InputState>;
  paused: boolean;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const clear = () => {
    input.current.analog = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
  };
  useEffect(() => {
    const state=input.current;
    if (paused) {
      input.current.analog = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
    }
    const reset = () => {
      input.current.analog = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
    };
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("blur", reset);
      state.analog = { x: 0, y: 0 };
    };
  }, [input, paused]);
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (paused || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const r = e.currentTarget.getBoundingClientRect(),
      dx = e.clientX - r.x - r.width / 2,
      dy = e.clientY - r.y - r.height / 2,
      length = Math.hypot(dx, dy),
      scale = Math.max(32, length);
    const vector =
      length < 10 ? { x: 0, y: 0 } : { x: dx / scale, y: dy / scale };
    input.current.analog = vector;
    setOffset({ x: vector.x * 30, y: vector.y * 30 });
  };
  return (
    <button
      type="button"
      aria-label="Виртуальный джойстик"
      disabled={paused}
      style={{
        position: "relative",
        width: 102,
        height: 102,
        minWidth: 102,
        borderRadius: "50%",
        border: "2px solid #b1cbd9",
        background: "#eef6fa",
        padding: 0,
        touchAction: "none",
        opacity: paused ? 0.55 : 1,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={clear}
      onPointerCancel={clear}
      onLostPointerCapture={clear}
    >
      <span
        aria-hidden="true"
        style={{
          display: "block",
          position: "absolute",
          left: 32,
          top: 32,
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "#58cc02",
          border: "2px solid #2e8d04",
          transform: `translate(${offset.x}px,${offset.y}px)`,
        }}
      />
    </button>
  );
}
