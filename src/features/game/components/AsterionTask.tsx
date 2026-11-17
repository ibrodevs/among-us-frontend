"use client";
import { useEffect, useRef, useState } from "react";
import type { Task } from "../network/types";
import { sound } from "../../audio/events";
import css from "./asterion.module.css";
const colors = ["#ef8e9c", "#7ad6eb", "#edce80", "#a6dc94"];
export function AsterionTask({
  task,
  now,
  onClose,
  onComplete,
}: {
  task: Task;
  now: number;
  onClose: () => void;
  onComplete: (solution: number[]) => void;
}) {
  const seed = task.challenge,
    kind = task.task_type;
  const [values, setValues] = useState<number[]>(() =>
    kind === "fuel_distribution"
      ? [100, 0, 0]
      : kind === "thermal_balance"
        ? [50, 50, 50]
        : Array(8).fill(0),
  );
  const [steps, setSteps] = useState<number[]>([]),
    [left, setLeft] = useState<number | null>(null),
    [flash, setFlash] = useState<number | null>(null),
    [watching, setWatching] = useState(kind === "sequence"),
    [error, setError] = useState(""),
    [held, setHeld] = useState(false),
    [progress, setProgress] = useState(0),
    [digit, setDigit] = useState("");
  const [locked, setLocked] = useState([false, false]);
  const rotorPhase = (i: number) => ((now / 12) * (i + 1)) % 360;
  const inSync = (i: number) => rotorPhase(i) < 55 || rotorPhase(i) > 305;
  const close = useRef<HTMLButtonElement>(null),
    began = useRef(now),
    done = useRef(false);
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const seedKey = JSON.stringify(seed);
  useEffect(() => {
    if (kind !== "sequence") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    JSON.parse(seedKey).forEach((n: number, i: number) => {
      timers.push(setTimeout(() => setFlash(n), 400 + i * 650));
      timers.push(setTimeout(() => setFlash(null), 800 + i * 650));
    });
    timers.push(setTimeout(() => setWatching(false), 450 + seed.length * 650));
    return () => timers.forEach(clearTimeout);
  }, [kind, seedKey, seed.length]);
  useEffect(() => {
    if (!held) return;
    const timer = setInterval(
      () =>
        setProgress((p) =>
          Math.min(
            kind === "upload" ? 100 : 3,
            p + (kind === "upload" ? 2 : 0.05),
          ),
        ),
      100,
    );
    return () => clearInterval(timer);
  }, [held, kind]);
  const packet = useRef(-1);
  useEffect(() => {
    const n = Math.floor(progress / (kind === "upload" ? 20 : 0.5));
    if (n > packet.current && progress > 0) {
      sound(kind === "upload" ? "upload.packet" : "scan.pulse");
      packet.current = n;
    }
  }, [progress, kind]);
  const elapsed =
    (now -
      Date.parse(task.started_at || new Date(began.current).toISOString())) /
    1000;
  const set = (index: number, value: number) =>
    setValues((v) => v.map((n, i) => (i === index ? value : n)));
  const sequence = (value: number, expected: number[]) => {
    if (value !== expected[steps.length]) {
      setSteps([]);
      setError("Порядок нарушен. Попробуйте снова.");
      sound("task.error");
    } else {
      setSteps((s) => [...s, value]);
      setError("");
    }
  };
  let solution: number[] = [];
  let solved = false;
  switch (kind) {
    case "wires":
      solution = values.slice(0, 4).map((v) => v - 1);
      solved = solution.every((v, i) => v === seed[i]);
      break;
    case "power_routing":
    case "fuel_distribution":
    case "shield_alignment":
    case "antenna_alignment":
    case "signal_frequency":
    case "thermal_balance":
    case "pressure_control":
      solution = values.slice(0, seed.length);
      solved = solution.every((v, i) => v === seed[i]);
      break;
    case "engine_calibration":
      solution = values.slice(0, 2);
      solved = solution.every((v, i) => v === seed[i]) && locked.every(Boolean);
      break;
    case "upload":
      solution = [seed[0]];
      solved = progress >= 100;
      break;
    case "medical_scan":
      solution = [seed[0], 3];
      solved = progress >= 3;
      break;
    case "oxygen_filters":
      solution = [...values.slice(0, 3), ...steps];
      solved = values.slice(0, 3).every((v) => v === 3) && steps.length === 3;
      break;
    case "sample_analysis":
      solution = steps;
      solved = steps.length === 1 && steps[0] === seed[0];
      break;
    case "cargo_sorting":
      solution = values.slice(0, 6).map((v) => v - 1);
      solved = solution.every((v, i) => v === seed[i]);
      break;
    case "navigation_route":
    case "sequence":
      solution = steps;
      solved = steps.length === seed.length;
      break;
    case "asteroid_defense":
    case "debris_removal":
      solution = steps;
      solved = steps.length === seed.length;
      break;
    case "coolant_valves":
      solution = steps;
      solved = steps.length === 12;
      break;
    case "access_terminal":
      solution = digit.split("").map(Number);
      solved = solution.length === 6 && solution.every((v, i) => v === seed[i]);
      break;
  }
  const slider = (
    i: number,
    min: number,
    max: number,
    label: string,
    step = 1,
  ) => (
    <label key={i} className={css.slider}>
      {label}
      <output>{values[i]}</output>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={values[i]}
        onChange={(e) => set(i, Number(e.target.value))}
      />
    </label>
  );
  const releaseHold = () => {
    setHeld(false);
    if (kind === "medical_scan") setProgress((p) => (p < 3 ? 0 : p));
  };
  const hold = (
    <button
      className="action"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setHeld(true);
      }}
      onPointerUp={releaseHold}
      onPointerCancel={releaseHold}
      onLostPointerCapture={releaseHold}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") setHeld(true);
      }}
      onKeyUp={releaseHold}
      onBlur={releaseHold}
    >
      Удерживать{" "}
      {kind === "upload"
        ? `${Math.floor(progress)}%`
        : `${progress.toFixed(1)} / 3`}
    </button>
  );
  return (
    <div className="modal-backdrop">
      <section
        className={`modal ${css.task}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-heading"
        onClick={(e) => {
          if ((e.target as Element).closest("button"))
            sound(
              kind === "wires"
                ? "wire.connect"
                : kind === "power_routing"
                  ? "relay.toggle"
                  : "task.tap",
            );
        }}
      >
        <div className="row">
          <p className="eyebrow">
            Терминал · этап {(task.stage || 0) + 1}/{task.stage_total || 1}
          </p>
          <button ref={close} className="action secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <h2 id="task-heading">{task.title}</h2>
        {kind === "wires" && (
          <>
            <p>Выберите разъём слева, затем соответствующий цвет справа.</p>
            <div className={css.wires}>
              <div>
                {seed.map((color, i) => (
                  <button
                    key={i}
                    className="action"
                    style={{
                      borderColor: colors[color],
                      background: left === i ? colors[color] : "#172838",
                      color: left === i ? "#102c38" : "#e2f1f5",
                    }}
                    onClick={() => setLeft(i)}
                  >
                    {values[i] ? "✓" : "●"} Кабель {i + 1}
                  </button>
                ))}
              </div>
              <div>
                {[0, 1, 2, 3].map((c) => (
                  <button
                    key={c}
                    className="action"
                    style={{ background: colors[c], color: "#102030" }}
                    onClick={() => {
                      if (left !== null) {
                        set(left, c + 1);
                        setLeft(null);
                      }
                    }}
                  >
                    Разъём {c + 1}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {kind === "power_routing" && (
          <>
            <p>
              Переключите реле согласно схеме:{" "}
              {seed.map((v) => (v ? "ON" : "OFF")).join(" · ")}
            </p>
            <svg
              viewBox="0 0 420 160"
              aria-label="Электрическая схема с узлами питания"
            >
              <path
                d="M10 80H40V25H380V80H410M40 80v55h340V80"
                fill="none"
                stroke="#9db4bf"
                strokeWidth="3"
              />
              {seed.map((active, i) => (
                <g key={i}>
                  <path
                    d={`M${50 + Math.floor(i / 2) * 130} ${i % 2 ? 135 : 25} L${80 + Math.floor(i / 2) * 130} ${i % 2 ? 115 : 45} L${110 + Math.floor(i / 2) * 130} ${i % 2 ? 135 : 25}`}
                    fill="none"
                    stroke={values[i] ? "#58cc02" : "#93aab7"}
                    strokeWidth={values[i] ? 5 : 2}
                  />
                  <circle
                    cx={80 + Math.floor(i / 2) * 130}
                    cy={i % 2 ? 115 : 45}
                    r="16"
                    fill={values[i] ? "#d7ffb8" : "#edf3f6"}
                    stroke={active ? "#58cc02" : "#8aa5b4"}
                    strokeWidth="3"
                  />
                  <text
                    x={80 + Math.floor(i / 2) * 130}
                    y={i % 2 ? 121 : 51}
                    textAnchor="middle"
                    fontSize="17"
                    fill="#042c60"
                  >
                    {i + 1}
                  </text>
                </g>
              ))}
            </svg>
            <div className={css.grid}>
              {seed.map((_, i) => (
                <button
                  key={i}
                  className="action secondary"
                  aria-pressed={Boolean(values[i])}
                  onClick={() => set(i, 1 - values[i])}
                >
                  Реле {i + 1}: {values[i] ? "ON" : "OFF"}
                </button>
              ))}
            </div>
          </>
        )}
        {kind === "upload" && (
          <>
            <p>
              Удерживайте канал передачи. При отпускании передача
              приостанавливается.
            </p>
            <progress max={100} value={progress} />
            {hold}
          </>
        )}
        {kind === "engine_calibration" && (
          <>
            <p>
              Настройте частоты {seed.join(" / ")}, затем зафиксируйте каждый
              ротор, когда индикатор находится в зелёной зоне.
            </p>
            <div className={css.rotors}>
              {seed.map((s, i) => (
                <div key={i}>
                  <span
                    style={{
                      display: "inline-block",
                      transform: `rotate(${locked[i] ? 0 : rotorPhase(i)}deg)`,
                      color: locked[i] || inSync(i) ? "#58cc02" : "#b77742",
                    }}
                  >
                    ✳
                  </span>
                  {slider(i, 0, 100, `Ротор ${i + 1} · цель ${s}`, 5)}
                  <button
                    className="action secondary"
                    disabled={locked[i] || values[i] !== s || !inSync(i)}
                    onClick={() =>
                      setLocked((v) => v.map((n, j) => (j === i ? true : n)))
                    }
                  >
                    {locked[i]
                      ? "✓ Готово"
                      : "Синхронизировать ротор " + (i + 1)}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {kind === "oxygen_filters" && (
          <>
            <p>
              Очистите каждый фильтр тремя проходами и откройте затворы в
              порядке: {seed.map((v) => v + 1).join(" → ")}.
            </p>
            {seed.map((_, i) => (
              <div className="row" key={i}>
                <button
                  className="action secondary"
                  disabled={values[i] >= 3}
                  onClick={() => set(i, values[i] + 1)}
                >
                  Фильтр {i + 1} · {values[i]}/3
                </button>
                <button
                  className="action"
                  disabled={
                    values.slice(0, 3).some((v) => v < 3) || steps.includes(i)
                  }
                  onClick={() => sequence(i, seed)}
                >
                  Открыть {i + 1}
                </button>
              </div>
            ))}
          </>
        )}
        {kind === "fuel_distribution" && (
          <>
            <p>Распределите 100 л между баками. План: {seed.join(" / ")} л.</p>
            <div className={css.grid}>
              {values.slice(0, 3).map((v, i) => (
                <div key={i}>
                  <div
                    className={css.tank}
                    style={{
                      background: `linear-gradient(to top,#dea754 ${v}%,#182839 ${v}%)`,
                    }}
                  >
                    {v} л
                  </div>
                  <button
                    className="action secondary"
                    disabled={values[i] < 5}
                    onClick={() =>
                      setValues((old) => {
                        const n = [...old];
                        n[i] -= 5;
                        n[(i + 1) % 3] += 5;
                        return n;
                      })
                    }
                  >
                    Перелить 5 л → {((i + 1) % 3) + 1}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {kind === "shield_alignment" && (
          <>
            <p>
              Поверните четыре сегмента щита:{" "}
              {seed.map((v) => ["↑", "→", "↓", "←"][v]).join(" ")}
            </p>
            <div className={css.grid}>
              {seed.map((_, i) => (
                <button
                  className="action"
                  key={i}
                  onClick={() => set(i, (values[i] + 1) % 4)}
                  style={{ fontSize: 40 }}
                >
                  {["↑", "→", "↓", "←"][values[i]]}
                </button>
              ))}
            </div>
          </>
        )}
        {kind === "medical_scan" && (
          <>
            <p>
              Встаньте на платформу и непрерывно удерживайте сканер до трёх
              измерений.
            </p>
            <div
              className={css.scanner}
              style={{ backgroundPosition: `0 ${(now / 10) % 100}%` }}
            >
              ◎
            </div>
            {hold}
          </>
        )}
        {kind === "sample_analysis" && (
          <>
            <p>Сравните образцы. Выберите пробирку с аномальной реакцией.</p>
            <div className={css.grid}>
              {seed.slice(1).map((v, i) => (
                <button
                  className="action secondary"
                  key={i}
                  onClick={() => setSteps([i])}
                  aria-pressed={steps[0] === i}
                >
                  <span
                    className={css.tank}
                    style={{
                      height: 120,
                      background: `linear-gradient(to top,${v > 50 ? "#ed92ab" : "#7cc6ba"} ${v}%,#15283a ${v}%)`,
                    }}
                  >
                    #{i + 1}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {kind === "cargo_sorting" && (
          <>
            <p>
              Перетащите контейнеры в подходящие отсеки или выберите отсек
              кнопкой. Метки: BIO / TECH / DATA.
            </p>
            <div className={css.grid}>
              {seed.map((v, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", String(i))
                  }
                  className={css.crate}
                >
                  {values[i] ? "✓ " : ""}
                  {["BIO", "TECH", "DATA"][v]} #{i + 1}
                  <select
                    aria-label={`Отсек контейнера ${i + 1}`}
                    value={values[i]}
                    onChange={(e) => set(i, Number(e.target.value))}
                  >
                    <option value={0}>Выберите</option>
                    {["BIO", "TECH", "DATA"].map((n, j) => (
                      <option key={n} value={j + 1}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className={css.grid}>
              {["BIO", "TECH", "DATA"].map((n, j) => (
                <div
                  key={n}
                  className={css.drop}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const i = Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isInteger(i) && i >= 0 && i < 6) set(i, j + 1);
                  }}
                >
                  {n}
                </div>
              ))}
            </div>
          </>
        )}
        {kind === "antenna_alignment" && (
          <>
            <p>
              Наведите антенну на маяк: азимут {seed[0]}°, высота {seed[1]}°.
            </p>
            <div className={css.radar}>
              <span
                style={{
                  transform: `rotate(${values[0]}deg)`,
                  display: "block",
                }}
              >
                ➤
              </span>
            </div>
            {slider(0, 0, 350, "Азимут", 10)}
            {slider(1, 0, 90, "Высота", 5)}
          </>
        )}
        {kind === "signal_frequency" && (
          <>
            <p>
              Совместите частоту {seed[0]} и фазу {seed[1]}°.
            </p>
            <svg viewBox="0 0 400 80" aria-label="Осциллограф">
              {[seed, [values[0], values[1]]].map((v, j) => (
                <polyline
                  key={j}
                  fill="none"
                  stroke={j ? "#eeaf73" : "#6addc8"}
                  strokeWidth="2"
                  points={Array.from(
                    { length: 100 },
                    (_, i) =>
                      `${i * 4},${40 + 30 * Math.sin((i * v[0]) / 200 + (v[1] * Math.PI) / 180)}`,
                  ).join(" ")}
                />
              ))}
            </svg>
            {slider(0, 0, 100, "Частота")}
            {slider(1, 0, 360, "Фаза", 1)}
          </>
        )}
        {kind === "navigation_route" && (
          <>
            <p>Постройте маршрут: {seed.map((n) => n + 1).join(" → ")}.</p>
            <div className={css.nav}>
              {Array.from({ length: 9 }, (_, i) => (
                <button
                  key={i}
                  className="action secondary"
                  aria-pressed={steps.includes(i)}
                  disabled={steps.includes(i)}
                  onClick={() => sequence(i, seed)}
                >
                  {i + 1}
                  {steps.includes(i) ? " ✓" : ""}
                </button>
              ))}
            </div>
          </>
        )}
        {kind === "asteroid_defense" && (
          <>
            <p>Поразите все семь движущихся астероидов.</p>
            <div className={css.space}>
              {seed
                .filter((id) => !steps.includes(id))
                .map((id) => (
                  <button
                    key={id}
                    aria-label={`Астероид ${id + 1}`}
                    className={css.asteroid}
                    style={{
                      left: `${8 + (Math.sin(now / 1700 + id * 2) + 1) * 33}%`,
                      top: `${10 + (id % 3) * 28}%`,
                    }}
                    onClick={() =>
                      setSteps((s) => (s.includes(id) ? s : [...s, id]))
                    }
                  >
                    ⬡
                  </button>
                ))}
            </div>
          </>
        )}
        {kind === "debris_removal" && (
          <>
            <p>
              Уберите шесть фрагментов в утилизатор. Перетащите фрагмент или
              выберите его, затем нажмите «Утилизировать».
            </p>
            <div className={css.grid}>
              {seed
                .filter((id) => !steps.includes(id))
                .map((id) => (
                  <button
                    key={id}
                    className="action secondary"
                    draggable
                    aria-pressed={left === id}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", String(id))
                    }
                    onClick={() => setLeft(id)}
                  >
                    ⌁ Фрагмент {id + 1}
                  </button>
                ))}
            </div>
            <button
              className={`action ${css.drop}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = Number(e.dataTransfer.getData("text/plain"));
                if (seed.includes(id))
                  setSteps((s) => (s.includes(id) ? s : [...s, id]));
              }}
              disabled={false}
              onClick={() => {
                if (left !== null) {
                  setSteps((s) => (s.includes(left) ? s : [...s, left]));
                  setLeft(null);
                }
              }}
            >
              Утилизировать {steps.length}/6
            </button>
          </>
        )}
        {kind === "thermal_balance" && (
          <>
            <p>
              Сбалансируйте три контура: {seed.join(" / ")}°. Сумма температур
              должна остаться 150°.
            </p>
            {seed.map((s, i) =>
              slider(i, 0, 100, `Контур ${i + 1} · ${s}°`, 5),
            )}
            <output>
              Сумма: {values.slice(0, 3).reduce((a, b) => a + b, 0)}°
            </output>
          </>
        )}
        {kind === "coolant_valves" && (
          <>
            <p>
              По три оборота каждого вентиля в порядке{" "}
              {seed.map((n) => n + 1).join(" → ")}.
            </p>
            <div className={css.grid}>
              {[0, 1, 2, 3].map((i) => (
                <button
                  className="action"
                  key={i}
                  onClick={() =>
                    sequence(
                      i,
                      seed.flatMap((n) => [n, n, n]),
                    )
                  }
                >
                  ✥ Вентиль {i + 1} · {steps.filter((n) => n === i).length}/3
                </button>
              ))}
            </div>
          </>
        )}
        {kind === "access_terminal" && (
          <>
            <p>
              Код доступа: <strong>{seed.join("")}</strong>
            </p>
            <output className={css.code}>{digit.padEnd(6, "_")}</output>
            <div className={css.nav}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                <button
                  className="action secondary"
                  key={n}
                  onClick={() => setDigit((v) => (v.length < 6 ? v + n : v))}
                >
                  {n}
                </button>
              ))}
              <button
                className="action secondary"
                onClick={() => setDigit((v) => v.slice(0, -1))}
              >
                ⌫
              </button>
            </div>
          </>
        )}
        {kind === "sequence" && (
          <>
            <p>
              {watching ? "Запомните импульсы" : "Повторите шесть импульсов"} ·{" "}
              {steps.length}/6
            </p>
            <div className={css.grid}>
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  className="action"
                  disabled={watching}
                  style={{
                    background: flash === i ? colors[i] : "#253446",
                    color: flash === i ? "#102c38" : "#e2f1f5",
                    minHeight: 80,
                  }}
                  onClick={() => sequence(i, seed)}
                >
                  ● {i + 1}
                </button>
              ))}
            </div>
          </>
        )}
        {kind === "pressure_control" && (
          <>
            <p>
              Поднимите давление каждого резервуара до 50 кПа, затем
              зафиксируйте регуляторы.
            </p>
            {seed.map((_, i) => (
              <div className="row" key={i}>
                <meter
                  min={0}
                  max={100}
                  low={45}
                  high={55}
                  optimum={50}
                  value={values[i]}
                />
                <span>{values[i]} кПа</span>
                <button
                  className="action secondary"
                  onClick={() => set(i, Math.max(0, values[i] - 5))}
                >
                  −5
                </button>
                <button
                  className="action secondary"
                  onClick={() => set(i, Math.min(100, values[i] + 5))}
                >
                  +5
                </button>
              </div>
            ))}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <p className="muted">
          {elapsed < task.seconds
            ? `Проверка терминала: ещё ${Math.ceil(task.seconds - elapsed)} с`
            : solved
              ? "Настройка готова к проверке"
              : "Завершите настройку оборудования"}
        </p>
        <button
          className="action"
          disabled={!solved || elapsed < task.seconds || done.current}
          onClick={() => {
            done.current = true;
            onComplete(solution);
            setTimeout(() => {
              done.current = false;
            }, 1000);
          }}
        >
          Подтвердить
        </button>
      </section>
    </div>
  );
}
