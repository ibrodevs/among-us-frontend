"use client";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { StationRenderer, station } from "../engine/asterion-renderer";
import { LocalMotionPredictor } from "../engine/local-prediction";
import { readDirection } from "../engine/input";
import type { InputState } from "../engine/input";
import type { Rect } from "../engine/types";
import type { OwnState, Snapshot, Task } from "../network/types";
import styles from "../game.module.css";
export function AsterionCanvas({
  snapshot,
  playerId,
  camera,
  tasks,
  input,
  active = false,
  ownState,
  movementSequence,
}: {
  snapshot: Snapshot;
  playerId: string;
  tasks?: Task[];
  input?: RefObject<InputState>;
  active?: boolean;
  ownState?: OwnState;
  movementSequence?: RefObject<number>;
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
  const ownRef = useRef(ownState);
  ownRef.current = ownState;
  const sequenceRef = useRef(movementSequence);
  sequenceRef.current = movementSequence;
  useEffect(() => {
    const surface = canvas.current,
      ctx = surface?.getContext("2d");
    if (!surface || !ctx) return;
    const renderer = new StationRenderer();
    const predictor = new LocalMotionPredictor();
    let doors: Snapshot["doors"], closedDoors: Rect[] = [];
    let wasAlive: boolean | undefined;
    let width = 1,
      height = 1,
      dpr = 1,
      slowWindows = 0,
      frame = 0,
      previous = performance.now(),
      samples: number[] = [];
    const resizeSurface = () => {
      surface.width = Math.round(width * dpr);
      surface.height = Math.round(height * dpr);
    };
    const resize = () => {
      const r = surface.getBoundingClientRect();
      width = r.width;
      height = r.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      slowWindows = 0;
      resizeSurface();
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
      const ownUpdate = ownRef.current;
      const ownIsCurrent = ownUpdate?.game_id === state.game_id &&
        ownUpdate.state_version >= state.state_version &&
        ownUpdate.x !== undefined && ownUpdate.y !== undefined;
      const confirmed = ownIsCurrent
        ? {
            x: ownUpdate.x!,
            y: ownUpdate.y!,
            version: ownUpdate.state_version,
            alive: ownUpdate.alive,
            inVent: ownUpdate.is_in_vent,
          }
        : own && {
            x: own.x,
            y: own.y,
            version: state.state_version,
            alive: own.alive,
            inVent: own.in_vent,
          };
      let predicted = null;
      if (confirmed && !confirmed.inVent && state.phase === "playing" && activeRef.current &&
          inputRef.current && !cameraRef.current) {
        if (wasAlive !== confirmed.alive) predictor.reset();
        wasAlive = confirmed.alive;
        if (doors !== state.doors) {
          doors = state.doors;
          closedDoors = doors?.filter((door) => door.closed).map((door) => door.bounds) ?? [];
        }
        predictor.sync(
          confirmed,
          confirmed.version,
          state.game_id,
          ownIsCurrent ? ownUpdate.last_move_seq : undefined,
        );
        const rawSpeed = state.settings?.speed;
        const speed = typeof rawSpeed === "number" && Number.isFinite(rawSpeed)
          ? rawSpeed : station.speed;
        predicted = predictor.advance(
          readDirection(inputRef.current.current),
          dt,
          station,
          closedDoors,
          speed,
          !confirmed.alive,
          sequenceRef.current?.current,
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
        const fps = 1000 / (samples.reduce((a, b) => a + b, 0) / samples.length);
        surface!.dataset.fps = fps.toFixed(1);
        surface!.dataset.chunks = String(stats?.cacheSize);
        samples = [];
        slowWindows = fps < 40 ? slowWindows + 1 : 0;
        if (inputRef.current && activeRef.current && slowWindows >= 2 && dpr > 1) {
          dpr = Math.max(1, dpr - 0.25);
          slowWindows = 0;
          resizeSurface();
        }
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
