"use client";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { StationRenderer, station } from "../engine/asterion-renderer";
import { LocalMotionPredictor } from "../engine/local-prediction";
import { readDirection } from "../engine/input";
import type { InputState } from "../engine/input";
import type { Snapshot, Task } from "../network/types";
import styles from "../game.module.css";
export function AsterionCanvas({
  snapshot,
  playerId,
  camera,
  tasks,
  input,
  active = false,
}: {
  snapshot: Snapshot;
  playerId: string;
  tasks?: Task[];
  input?: RefObject<InputState>;
  active?: boolean;
  camera?: {
    x: number;
    y: number;
    radius: number;
    zoom?: number;
    review?: boolean;
    freeze?: boolean;
  };
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(snapshot);
  latest.current = snapshot;
  const taskRef = useRef(tasks);
  taskRef.current = tasks;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const inputRef = useRef(input);
  inputRef.current = input;
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    const surface = canvas.current,
      ctx = surface?.getContext("2d");
    if (!surface || !ctx) return;
    const renderer = new StationRenderer();
    const predictor = new LocalMotionPredictor();
    let width = 1,
      height = 1,
      dpr = 1,
      frame = 0,
      previous = performance.now(),
      samples: number[] = [];
    const resize = () => {
      const r = surface.getBoundingClientRect();
      width = r.width;
      height = r.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      surface.width = Math.round(width * dpr);
      surface.height = Math.round(height * dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    function draw(time: number) {
      const dt = Math.min(0.1, (time - previous) / 1000);
      samples.push(time - previous);
      previous = time;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      const state = latest.current;
      const own = state.players.find((p) => p.id === playerId);
      let predicted = null;
      if (own && state.phase === "playing" && activeRef.current &&
          inputRef.current && !cameraRef.current) {
        predictor.sync({ x: own.x, y: own.y }, state.state_version, state.game_id);
        const rawSpeed = state.settings?.speed;
        const speed = typeof rawSpeed === "number" && Number.isFinite(rawSpeed)
          ? rawSpeed : station.speed;
        predicted = predictor.advance(
          readDirection(inputRef.current.current),
          dt,
          station,
          state.doors?.filter((d) => d.closed).map((d) => d.bounds) || [],
          speed,
          !own.alive,
        );
      } else {
        predictor.reset();
      }
      const stats = renderer.draw(
        ctx!,
        state,
        playerId,
        width,
        height,
        Date.now(),
        dt,
        cameraRef.current,
        taskRef.current,
        predicted,
      );
      if (samples.length >= 120) {
        surface!.dataset.fps = (
          1000 /
          (samples.reduce((a, b) => a + b, 0) / samples.length)
        ).toFixed(1);
        surface!.dataset.chunks = String(stats?.cacheSize);
        samples = [];
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.clear();
      predictor.reset();
    };
  }, [playerId]);
  return (
    <canvas
      ref={canvas}
      className={styles.world}
      aria-label="ASTERION — игровая сцена"
    />
  );
}
