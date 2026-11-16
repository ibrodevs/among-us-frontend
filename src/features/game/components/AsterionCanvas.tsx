"use client";
import { useEffect, useRef } from "react";
import { StationRenderer } from "../engine/asterion-renderer";
import type { Snapshot } from "../network/types";
import styles from "../game.module.css";
export function AsterionCanvas({
  snapshot,
  playerId,
}: {
  snapshot: Snapshot;
  playerId: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(snapshot);
  latest.current = snapshot;
  useEffect(() => {
    const surface = canvas.current,
      ctx = surface?.getContext("2d");
    if (!surface || !ctx) return;
    const renderer = new StationRenderer();
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
      const stats = renderer.draw(
        ctx!,
        latest.current,
        playerId,
        width,
        height,
        Date.now(),
        dt,
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
    };
  }, [playerId]);
  return (
    <canvas
      ref={canvas}
      className={styles.canvas}
      aria-label="ASTERION — игровая сцена"
    />
  );
}
