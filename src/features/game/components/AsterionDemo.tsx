"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { station } from "../engine/asterion-renderer";
import { updateMovement } from "../engine/movement";
import { readDirection } from "../engine/input";
import { useGameInput } from "../hooks/useGameInput";
import type { MapConfig } from "../engine/types";
import type { Snapshot, OwnState } from "../network/types";
import { AsterionCanvas } from "./AsterionCanvas";
import { GameControls } from "./GameHud";
import { StationMap } from "./StationMap";
import css from "./asterion.module.css";
const geometry: MapConfig = {
  ...station,
  zones: [],
  corridors: [],
  spawnPoints: [],
  taskPoints: [],
};
export function AsterionDemo() {
  const [map, setMap] = useState(false),
    [position, setPosition] = useState({ x: 2930, y: 1970 }),
    pos = useRef(position),
    close = useCallback(() => setMap(false), []),
    input = useGameInput(map, close);
  useEffect(() => {
    let frame = 0,
      previous = performance.now();
    const draw = (now: number) => {
      if (!map) {
        pos.current = updateMovement(
          pos.current,
          readDirection(input.current),
          (now - previous) / 1000,
          geometry,
          220,
        );
        setPosition(pos.current);
      }
      previous = now;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const key = (e: KeyboardEvent) => {
      if (e.code === "KeyM" && !e.repeat) setMap((v) => !v);
    };
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key);
    };
  }, [map, input]);
  const snapshot: Snapshot = {
    type: "game.snapshot",
    protocol_version: 2,
    map_version: 2,
    map_mode: "full",
    game_id: "demo",
    state_version: 0,
    server_time: new Date().toISOString(),
    phase: "playing",
    players: [
      {
        id: "demo",
        nickname: "Исследователь",
        ...position,
        alive: true,
        color: 0,
      },
    ],
    bodies: [],
    tasks_completed: 0,
    tasks_total: 0,
    last_meeting_result: null,
    meeting: null,
    vision_radius: 800,
    doors: station.doors.map((d) => ({ ...d, closed: false })),
  };
  const own: OwnState = {
    type: "game.self",
    map_version: 2,
    game_id: "demo",
    state_version: 0,
    role: "crew",
    alive: true,
    last_move_seq: 0,
    kill_available_at: null,
    emergency_used: false,
    has_voted: false,
    tasks: [],
    ...position,
  };
  return (
    <main className={css.screen}>
      <header className="row">
        <div>
          <p className="eyebrow">
            Локальное исследование · Без подключения к матчу
          </p>
          <h1>ASTERION · Демо карты</h1>
        </div>
        <Link className="action secondary" href="/">
          Главное меню
        </Link>
      </header>
      <p>
        21 помещение · 40 терминалов · 20 люков. Задания, роли и аварии доступны
        в сетевом матче от 4 игроков.
      </p>
      <div className={css.viewport}>
        <AsterionCanvas snapshot={snapshot} playerId="demo" />
      </div>
      <GameControls input={input} paused={map} escapeLabel="Закрыть карту" />
      <button className="action" onClick={() => setMap(true)}>
        Карта · M
      </button>
      {map && (
        <StationMap
          snapshot={snapshot}
          own={own}
          send={() => false}
          onClose={close}
        />
      )}
    </main>
  );
}
