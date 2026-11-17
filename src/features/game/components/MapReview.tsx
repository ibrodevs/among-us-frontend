"use client";
import { useState } from "react";
import Link from "next/link";
import { AsterionCanvas } from "./AsterionCanvas";
import { StationMap } from "./StationMap";
import station from "../engine/asterion.json";
import type { Snapshot, OwnState } from "../network/types";
import css from "./asterion.module.css";
export function MapReview() {
  const [roomId, setRoomId] = useState("nexus"),
    [scene, setScene] = useState("normal"),
    [map, setMap] = useState(false);
  const sector = roomId.startsWith("sector:") ? roomId.slice(7) : null;
  const selected = station.rooms.filter((r) => r.sector === sector);
  const region = selected.length
    ? {
        x: Math.min(...selected.map((r) => r.bounds.x)),
        y: Math.min(...selected.map((r) => r.bounds.y)),
        right: Math.max(...selected.map((r) => r.bounds.x + 900)),
        bottom: Math.max(...selected.map((r) => r.bounds.y + 520)),
      }
    : null;
  const r = station.rooms.find((r) => r.id === roomId),
    p = r
      ? { x: r.bounds.x + 450, y: r.bounds.y + 260 }
      : region
        ? {
            x: (region.x + region.right) / 2,
            y: (region.y + region.bottom) / 2,
          }
        : { x: 3072, y: 2048 };
  const actor =
    scene === "vent" && r
      ? station.vents.find((v) => v.room_id === r.id) || p
      : scene === "task" && r
        ? station.tasks.find((v) => v.room_id === r.id) || p
        : (station.navigation.nodes.find(n=>n.id===r?.id)||p);
  const snapshot: Snapshot = {
    type: "game.snapshot",
    protocol_version: 2,
    map_version: 2,
    map_mode: "full",
    game_id: "visual-review",
    state_version: 0,
    server_time: "2026-01-01T00:00:00Z",
    phase: "playing",
    players: [
      {
        id: "review",
        nickname: "Исследователь",
        ...actor,
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
    doors: station.doors.map((d) => ({ ...d, closed: scene === "doors" })),
    sabotages:
      scene === "emergency"
        ? [
            {
              id: "visual-reactor",
              kind: "reactor",
              deadline_at: "2026-01-01T00:01:30Z",
              panels: [],
              repaired_panels: [],
            },
          ]
        : [],
  };
  const own: OwnState = {
    type: "game.self",
    game_id: snapshot.game_id,
    state_version: 0,
    role: "crew",
    alive: true,
    last_move_seq: 0,
    kill_available_at: null,
    emergency_used: false,
    has_voted: false,
    tasks: [],
    ...actor,
  };
  return (
    <main className={css.screen}>
      <header className="row">
        <div>
          <p className="eyebrow">ASTERION 2.1 · Студия визуальной проверки</p>
          <h1>{r?.name || sector || "Обзор станции"}</h1>
        </div>
        <Link className="action secondary" href="/demo/asterion">
          Исследовать пешком
        </Link>
      </header>
      <div className="row">
        <label>
          Помещение{" "}
          <select
            aria-label="Обзор помещения"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            <option value="all">Вся станция</option>
            {["engineering", "command", "science", "logistics"].map((s) => (
              <option key={s} value={"sector:" + s}>
                {s}
              </option>
            ))}
            {station.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Сцена{" "}
          <select
            aria-label="Сцена"
            value={scene}
            onChange={(e) => setScene(e.target.value)}
          >
            <option value="normal">Обычный свет</option>
            <option value="task">У задания</option>
            <option value="vent">У люка</option>
            <option value="doors">Закрытые двери</option>
            <option value="emergency">Аварийный свет</option>
          </select>
        </label>
        <button className="action secondary" onClick={() => setMap(true)}>
          Мини-карта
        </button>
      </div>
      <div
        className={css.viewport}
        style={{ height: 640, minHeight: 340 }}
        data-testid="review-scene"
      >
        <AsterionCanvas
          key={roomId + scene}
          snapshot={snapshot}
          playerId="review"
          camera={{
            ...p,
            radius: 800,
            zoom: r
              ? 1
              : region
                ? Math.min(
                    1100 / (region.right - region.x + 120),
                    620 / (region.bottom - region.y + 120),
                  )
                : 0.15,
            review: true,
            freeze: true,
          }}
        />
      </div>
      <p>
        {r
          ? `${r.visual.layoutId} · ${r.visual.floorMaterial} · ${r.visual.audioProfile}`
          : "21 помещение · 40 заданий · 20 люков"}
      </p>
      <p>
        Этот инструмент включается только явным MAP_REVIEW_ENABLED=true при
        сборке локальной или тестовой версии.
      </p>
      {map && (
        <StationMap
          snapshot={snapshot}
          own={own}
          onClose={() => setMap(false)}
          send={() => false}
        />
      )}
    </main>
  );
}
