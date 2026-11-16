import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { calculateCamera } from "../engine/camera";
import { readDirection } from "../engine/input";
import type { InputState } from "../engine/input";
import { contains, demoCrew, mapConfig } from "../engine/map-config";
import { updateMovement } from "../engine/movement";
import { paintStation, renderRadar, renderWorld } from "../engine/render-world";
import type { GamePhase, PlayerVisualState } from "../engine/types";
import styles from "../game.module.css";

type Props = {
  input: RefObject<InputState>;
  radar: RefObject<HTMLCanvasElement | null>;
  phase: GamePhase;
  onZoneChange: (zone: string) => void;
};

export function GameCanvas({ input, radar, phase, onZoneChange }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<PlayerVisualState>({
    id: "local-demo", position: mapConfig.spawnPoints[0], color: "#98e44b",
    facing: 1, moving: false, label: "Вы",
  });

  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext("2d");
    if (!surface || !context) return;

    const scenery = document.createElement("canvas");
    scenery.width = mapConfig.width;
    scenery.height = mapConfig.height;
    const background = scenery.getContext("2d");
    if (!background) return;
    paintStation(background);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const radarSurface = radar.current;
    const radarContext = radarSurface?.getContext("2d");
    const local = player.current;
    const viewport = { width: 1, height: 1 };
    let previousTime: number | undefined;
    let frameId = 0;
    let zoneName = "";
    let pixelRatio = 1;

    const tick = (now: number) => {
      const dt = previousTime === undefined ? 0 : (now - previousTime) / 1000;
      previousTime = now;
      const direction = readDirection(input.current);
      const next = phase === "demo" ? updateMovement(local.position, direction, dt, mapConfig) : local.position;
      local.moving = next.x !== local.position.x || next.y !== local.position.y;
      if (next.x !== local.position.x) local.facing = next.x < local.position.x ? -1 : 1;
      local.position = next;

      const zone = mapConfig.zones.find(item => contains(item.bounds, next))?.name ?? "Переход";
      if (zone !== zoneName) {
        zoneName = zone;
        onZoneChange(zone);
      }

      const camera = calculateCamera(next, viewport, mapConfig);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      renderWorld(context, scenery, demoCrew, local, camera, motion.matches ? 0 : now);
      if (radarSurface && radarContext) {
        const scale = radarSurface.width / mapConfig.width;
        radarContext.setTransform(scale, 0, 0, scale, 0, 0);
        renderRadar(radarContext, local, camera, viewport);
      }
      if (phase === "demo" && !document.hidden) frameId = requestAnimationFrame(tick);
    };

    const restart = () => {
      cancelAnimationFrame(frameId);
      previousTime = undefined;
      if (!document.hidden) frameId = requestAnimationFrame(tick);
    };

    const resize = () => {
      const size = surface.getBoundingClientRect();
      viewport.width = Math.max(1, size.width);
      viewport.height = Math.max(1, size.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.ceil(viewport.width * pixelRatio);
      surface.height = Math.ceil(viewport.height * pixelRatio);
      restart();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    document.addEventListener("visibilitychange", restart);
    resize();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", restart);
      cancelAnimationFrame(frameId);
    };
  }, [input, radar, phase, onZoneChange]);

  return <canvas ref={canvas} className={styles.world} aria-label="Игровая карта станции">
    Интерактивная карта станции с четырьмя зонами.
  </canvas>;
}
