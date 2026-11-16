"use client";
import { useEffect, useRef } from "react";
import { calculateCamera } from "../engine/camera";
import { paintStation, renderWorld } from "../engine/render-world";
import { mapConfig } from "../engine/map-config";
import type { PlayerVisualState } from "../engine/types";
import type { Snapshot } from "../network/types";
import styles from "../game.module.css";
const colors = [
  "#58cc02",
  "#1cb0f6",
  "#d7ffb8",
  "#ffffff",
  "#a5ed6e",
  "#777777",
  "#58cc02",
  "#1cb0f6",
  "#d7ffb8",
  "#ffffff",
];

export function LiveCanvas({
  snapshot,
  playerId,
}: {
  snapshot: Snapshot;
  playerId: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    const surface = canvas.current,
      ctx = surface?.getContext("2d");
    if (!surface || !ctx) return;
    const scenery = document.createElement("canvas");
    scenery.width = mapConfig.width;
    scenery.height = mapConfig.height;
    const bg = scenery.getContext("2d");
    if (!bg) return;
    paintStation(bg);
    const shown = new Map<string, PlayerVisualState>();
    let frame = 0,
      previous = 0,
      width = 1,
      height = 1,
      dpr = 1;
    const resize = () => {
      const r = surface.getBoundingClientRect();
      width = r.width;
      height = r.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      surface.width = width * dpr;
      surface.height = height * dpr;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    function draw(now: number) {
      const data = latest.current,
        dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const visuals = data.players
        .filter((p) => p.alive || p.id === playerId)
        .map((p) => {
          let v = shown.get(p.id);
          if (!v) {
            v = {
              id: p.id,
              position: { x: p.x, y: p.y },
              color:
                colors[
                  data.players.findIndex((o) => o.id === p.id) % colors.length
                ],
              facing: 1,
              moving: false,
              label: p.nickname,
            };
            shown.set(p.id, v);
          }
          const dx = p.x - v.position.x,
            dy = p.y - v.position.y;
          v.moving = Math.hypot(dx, dy) > 1;
          if (Math.abs(dx) > 1) v.facing = dx < 0 ? -1 : 1;
          const blend = Math.hypot(dx, dy) > 100 ? 1 : Math.min(1, dt * 16);
          v.position = {
            x: v.position.x + dx * blend,
            y: v.position.y + dy * blend,
          };
          return v;
        });
      const self = visuals.find((p) => p.id === playerId);
      if (self) {
        const camera = calculateCamera(
          self.position,
          { width, height },
          mapConfig,
        );
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx!.clearRect(0, 0, width, height);
        renderWorld(
          ctx!,
          scenery,
          visuals.filter((p) => p.id !== playerId),
          self,
          camera,
          now,
        );
        ctx!.save();
        ctx!.scale(camera.scale, camera.scale);
        ctx!.translate(-camera.x, -camera.y);
        for (const body of data.bodies) {
          ctx!.fillStyle = "#fff";
          ctx!.strokeStyle = "#042c60";
          ctx!.lineWidth = 4;
          ctx!.beginPath();
          ctx!.roundRect(body.x - 18, body.y - 8, 36, 19, 7);
          ctx!.fill();
          ctx!.stroke();
          ctx!.fillStyle = "#042c60";
          ctx!.font = "bold 14px Nunito";
          ctx!.fillText("REPORT", body.x - 28, body.y - 18);
        }
        ctx!.fillStyle = "#58cc02";
        ctx!.beginPath();
        ctx!.arc(800, 450, 15, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "#000437";
        ctx!.font = "bold 18px Nunito";
        ctx!.textAlign = "center";
        ctx!.fillText("!", 800, 457);
        ctx!.restore();
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [playerId]);
  return (
    <canvas
      className={styles.world}
      ref={canvas}
      aria-label="Карта станции. Передвижение WASD, стрелками или сенсорными кнопками."
    />
  );
}
