"use client";
import { useState } from "react";
import type { OwnState, Command } from "../network/types";
import css from "./asterion.module.css";
export function RepairPanel({
  repair,
  send,
}: {
  repair: NonNullable<OwnState["repair"]>;
  send: (c: Command) => boolean;
}) {
  const [switches, setSwitches] = useState([0, 0, 0, 0, 0, 0]),
    [code, setCode] = useState(""),
    [signal, setSignal] = useState([0, 0]);
  const solved =
    repair.kind === "lights"
      ? switches.every((n, i) => n === repair.challenge[i])
      : repair.kind === "oxygen"
        ? code === repair.challenge.join("")
        : signal.every((n, i) => n === repair.challenge[i]);
  return (
    <section className={css.terminal}>
      <h2>Восстановление · {repair.kind}</h2>
      {repair.kind === "lights" && (
        <>
          <p>
            Переключите реле по схеме{" "}
            {repair.challenge.map((n) => (n ? "ON" : "OFF")).join(" · ")}.
          </p>
          <div className={css.grid}>
            {switches.map((n, i) => (
              <button
                key={i}
                className="action secondary"
                aria-pressed={Boolean(n)}
                onClick={() =>
                  setSwitches((v) => v.map((q, j) => (j === i ? 1 - q : q)))
                }
              >
                Реле {i + 1} · {n ? "ON" : "OFF"}
              </button>
            ))}
          </div>
        </>
      )}
      {repair.kind === "oxygen" && (
        <>
          <p>
            Код панели: <strong>{repair.challenge.join("")}</strong>
          </p>
          <output className={css.code}>{code.padEnd(4, "_")}</output>
          <div className={css.nav}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
              <button
                className="action secondary"
                key={n}
                onClick={() => setCode((v) => (v.length < 4 ? v + n : v))}
              >
                {n}
              </button>
            ))}
            <button
              className="action secondary"
              onClick={() => setCode((v) => v.slice(0, -1))}
            >
              ⌫
            </button>
          </div>
        </>
      )}
      {repair.kind === "comms" && (
        <>
          <p>
            Настройте частоту {repair.challenge[0]} и фазу {repair.challenge[1]}
            °.
          </p>
          <svg viewBox="0 0 400 80" aria-label="Сигнал связи">
            {[repair.challenge, signal].map((v, j) => (
              <polyline
                key={j}
                fill="none"
                stroke={j ? "#efac81" : "#72dfcc"}
                strokeWidth="2"
                points={Array.from(
                  { length: 100 },
                  (_, i) =>
                    `${i * 4},${40 + 30 * Math.sin((i * v[0]) / 200 + (v[1] * Math.PI) / 180)}`,
                ).join(" ")}
              />
            ))}
          </svg>
          {["Частота", "Фаза"].map((label, i) => (
            <label className={css.slider} key={label}>
              {label} · {signal[i]}
              <input
                aria-label={label}
                type="range"
                min="0"
                max={i ? 359 : 100}
                value={signal[i]}
                onChange={(e) =>
                  setSignal((v) =>
                    v.map((n, j) => (i === j ? Number(e.target.value) : n)),
                  )
                }
              />
            </label>
          ))}
        </>
      )}
      <button
        className="action"
        disabled={!solved}
        onClick={() =>
          send({
            type: "sabotage.repair.complete",
            sabotage_id: repair.sabotage_id,
            panel_id: repair.panel_id,
            solution:
              repair.kind === "lights"
                ? switches
                : repair.kind === "oxygen"
                  ? code.split("").map(Number)
                  : signal,
          })
        }
      >
        Восстановить
      </button>
    </section>
  );
}
