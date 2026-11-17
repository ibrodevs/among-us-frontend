"use client";
import { useRef, useState } from "react";
import { station } from "../engine/asterion-renderer";
import type { OwnState, Snapshot, Command } from "../network/types";
import css from "./asterion.module.css";
export function StationMap({
  snapshot,
  own,
  onClose,
  send,
  tactical = false,
  serverNow = Date.now(),
}: {
  snapshot: Snapshot;
  own: OwnState;
  onClose: () => void;
  send: (c: Command) => boolean;
  tactical?: boolean;
  serverNow?: number;
}) {
  const cooldown =
    Math.max(
      0,
      Math.ceil(
        (Date.parse(own.sabotage_available_at || " ") - serverNow) / 1000,
      ),
    ) || 0;
  const unavailable =
    cooldown > 0 ||
    own.is_in_vent ||
    (!own.alive && !snapshot.settings?.ghost_sabotage);
  const [pan, setPan] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [sector, setSector] = useState("all");
  const [roomId, setRoomId] = useState("");
  const area =
    sector === "all"
      ? { x: 0, y: 0, width: 6144, height: 4096 }
      : station.rooms
          .filter((r) => r.sector === sector)
          .reduce(
            (a, r) => ({
              x: Math.min(a.x, r.bounds.x),
              y: Math.min(a.y, r.bounds.y),
              width: Math.max(a.width, r.bounds.x + r.bounds.width),
              height: Math.max(a.height, r.bounds.y + r.bounds.height),
            }),
            { x: 6144, y: 4096, width: 0, height: 0 },
          );
  const focused = station.rooms.find((r) => r.id === roomId);
  const view = focused
    ? `${focused.bounds.x - 80} ${focused.bounds.y - 80} ${focused.bounds.width + 160} ${focused.bounds.height + 160}`
    : `${area.x - 80} ${area.y - 80} ${sector === "all" ? 6304 : area.width - area.x + 160} ${sector === "all" ? 4256 : area.height - area.y + 160}`;
  const [vx, vy, vw, vh] = view.split(" ").map(Number);
  const zoomView = `${vx + (vw * (1 - 1 / pan.scale)) / 2 + pan.x} ${vy + (vh * (1 - 1 / pan.scale)) / 2 + pan.y} ${vw / pan.scale} ${vh / pan.scale}`;
  return (
    <div className="modal-backdrop">
      <section
        className={`modal ${css.task}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-map-title"
      >
        <div className="row">
          <h2 id="station-map-title">
            {tactical ? "Тактическая карта" : "ASTERION"}
          </h2>
          <button className="action secondary" onClick={onClose}>
            Закрыть карту
          </button>
        </div>
        <label>
          Сектор{" "}
          <select
            aria-label="Сектор"
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setPan({ x: 0, y: 0, scale: 1 });
              setRoomId("");
            }}
          >
            {["all", "engineering", "command", "science", "logistics"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Помещение{" "}
          <select
            aria-label="Помещение"
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              setPan({ x: 0, y: 0, scale: 1 });
            }}
          >
            <option value="">Обзор станции</option>
            {station.rooms.map((r) => (
              <option
                key={r.id}
                value={r.id}
                disabled={snapshot.map_mode === "compact" && !r.compact}
              >
                {r.name}
                {snapshot.map_mode === "compact" && !r.compact
                  ? " · закрыто"
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="row" aria-label="Масштаб карты">
          <button
            className="action secondary"
            aria-label="Приблизить карту"
            onClick={() =>
              setPan((p) => ({ ...p, scale: Math.min(5, p.scale * 1.4) }))
            }
          >
            +
          </button>
          <button
            className="action secondary"
            aria-label="Отдалить карту"
            onClick={() =>
              setPan((p) => ({ ...p, scale: Math.max(1, p.scale / 1.4) }))
            }
          >
            −
          </button>
          <button
            className="action secondary"
            onClick={() => setPan({ x: 0, y: 0, scale: 1 })}
          >
            Сбросить обзор
          </button>
        </div>
        <svg
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const box = e.currentTarget.getBoundingClientRect(),
              dx = e.clientX - drag.current.x,
              dy = e.clientY - drag.current.y;
            drag.current = { x: e.clientX, y: e.clientY };
            setPan((p) => ({
              ...p,
              x: p.x - (dx * vw) / p.scale / box.width,
              y: p.y - (dy * vh) / p.scale / box.height,
            }));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          className={css.map}
          viewBox={zoomView}
          role="img"
          aria-label="Карта комнат и собственных заданий"
        >
          {station.corridors.map((c) => (
            <rect key={c.id} {...c.bounds} fill="#293d50" />
          ))}
          {station.rooms.map((r) => (
            <g
              key={r.id}
              role="button"
              tabIndex={0}
              aria-label={r.name}
              style={{ cursor: "pointer" }}
              onClick={() => setRoomId(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setRoomId(r.id);
                }
              }}
              opacity={snapshot.map_mode === "compact" && !r.compact ? 0.2 : 1}
            >
              <title>{r.name}</title>
              {r.floor_parts.map((p, i) => (
                <rect key={i} {...p} fill={r.visual.ambientLight} />
              ))}
              <path
                d={r.outline
                  .map(([x, y, xx, yy]) => `M${x} ${y}L${xx} ${yy}`)
                  .join(" ")}
                fill="none"
                stroke={r.visual.accentColor}
                strokeWidth="9"
              />
              <text
                x={r.bounds.x + r.bounds.width / 2}
                y={r.bounds.y + 70}
                textAnchor="middle"
                fill="#e1eff4"
                fontSize="48"
              >
                {r.name}
              </text>
            </g>
          ))}
          {(snapshot.doors || [])
            .filter((d) => d.closed)
            .map((d) => (
              <rect key={d.id} {...d.bounds} fill="#e27d85" />
            ))}
          {own.tasks
            .filter((t) => !t.is_completed)
            .map((t) => (
              <g key={t.id}>
                <circle cx={t.x} cy={t.y} r="35" fill="#f1cf76" />
                <text
                  x={t.x}
                  y={t.y + 18}
                  fontSize="50"
                  textAnchor="middle"
                  fill="#112033"
                >
                  !
                </text>
              </g>
            ))}
          {snapshot.sabotages?.flatMap((s) =>
            s.panels.map((p) => (
              <g key={p.id}>
                <circle cx={p.x} cy={p.y} r="55" fill="#ed687b" />
                <text x={p.x + 70} y={p.y} fontSize="45" fill="#fff">
                  {s.kind}
                </text>
              </g>
            )),
          )}
          {own.x !== undefined && (
            <circle
              cx={own.x}
              cy={own.y}
              r="42"
              fill="#71f4de"
              stroke="#fff"
              strokeWidth="10"
            />
          )}
        </svg>
        <p>
          ● Вы · <span style={{ color: "#f1cf76" }}>● Ваши задания</span> ·{" "}
          <span style={{ color: "#ed687b" }}>● Авария / закрытая дверь</span>
        </p>
        {tactical && cooldown > 0 && (
          <p>Системы восстанавливаются · {cooldown} с</p>
        )}
        {tactical && (
          <div className={css.grid}>
            {["lights", "reactor", "oxygen", "comms"].map((kind) => (
              <button
                className="action"
                key={kind}
                disabled={
                  unavailable ||
                  snapshot.sabotages?.some(
                    (s) =>
                      s.kind === kind ||
                      (["reactor", "oxygen"].includes(kind) &&
                        ["reactor", "oxygen"].includes(s.kind)),
                  )
                }
                onClick={() => send({ type: "sabotage.start", kind })}
              >
                {kind}
              </button>
            ))}
            {Array.from(new Set(station.doors.map((d) => d.group))).map(
              (group) => (
                <button
                  key={group}
                  className="action secondary"
                  disabled={
                    unavailable ||
                    snapshot.sabotages?.some((s) => s.kind === "doors")
                  }
                  onClick={() =>
                    send({ type: "sabotage.start", kind: "doors", group })
                  }
                >
                  Двери · {group}
                </button>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
