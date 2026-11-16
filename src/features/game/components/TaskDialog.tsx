"use client";
import { useEffect, useRef, useState } from "react";
import type { Task } from "../network/types";
const names = {
  wires: "Wire Link · Соедини разъёмы",
  sequence: "Sequence · Повтори сигнал",
  upload: "Upload · Загрузка данных",
};
export function TaskDialog({
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
  const close = useRef<HTMLButtonElement>(null);
  const [solution, setSolution] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const [watching, setWatching] = useState(task.task_type === "sequence");
  const [mistake, setMistake] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const elements = close.current
          ?.closest("section")
          ?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  useEffect(() => {
    if (task.task_type !== "sequence") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    task.challenge.forEach((value, index) => {
      timers.push(setTimeout(() => setFlash(value), 500 + index * 850));
      timers.push(setTimeout(() => setFlash(null), 1050 + index * 850));
    });
    timers.push(setTimeout(() => setWatching(false), 4000));
    return () => timers.forEach(clearTimeout);
  }, [task]);
  const elapsed = task.started_at
    ? Math.max(0, (now - Date.parse(task.started_at)) / 1000)
    : 0;
  const ready = elapsed >= task.seconds;
  function enter(value: number) {
    const next = [...solution, value];
    if (value !== task.challenge[next.length - 1]) {
      setSolution([]);
      setMistake(true);
      return;
    }
    setMistake(false);
    setSolution(next);
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal task-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-title"
      >
        <div className="row">
          <h2 id="task-title">{names[task.task_type]}</h2>
          <button
            ref={close}
            className="action secondary"
            onClick={onClose}
            aria-label="Закрыть задание"
          >
            ×
          </button>
        </div>
        {task.task_type === "wires" && (
          <>
            <p>Соедини разъёмы A, B, C с соответствующими номерами.</p>
            <div className="wire-hints">
              {task.challenge.map((v, i) => (
                <span key={i}>
                  {["A", "B", "C"][i]} → {v + 1}
                </span>
              ))}
            </div>
            <p>Подключи {["A", "B", "C"][solution.length] || "готово"}</p>
            <div className="task-grid">
              {[0, 1, 2].map((v) => (
                <button
                  className="action secondary"
                  key={v}
                  disabled={solution.length === 3}
                  onClick={() => enter(v)}
                >
                  {v + 1}
                </button>
              ))}
            </div>
          </>
        )}
        {task.task_type === "sequence" && (
          <>
            <p aria-live="polite">
              {watching
                ? "Запомни четыре сигнала"
                : "Повтори последовательность"}{" "}
              · {solution.length}/4
            </p>
            <div className="task-grid">
              {[0, 1, 2, 3].map((v) => (
                <button
                  key={v}
                  className={flash === v ? "action" : "action secondary"}
                  disabled={watching || solution.length === 4}
                  onClick={() => enter(v)}
                  aria-label={"Сигнал " + (v + 1)}
                >
                  {v + 1}
                </button>
              ))}
            </div>
          </>
        )}
        {task.task_type === "upload" && (
          <>
            <p>Не отходи от терминала, пока идёт передача.</p>
            <div
              className="bar"
              role="progressbar"
              aria-valuenow={Math.min(
                100,
                Math.round((elapsed / task.seconds) * 100),
              )}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                style={{
                  width: Math.min(100, (elapsed / task.seconds) * 100) + "%",
                }}
              />
            </div>
            <p>{Math.min(100, Math.round((elapsed / task.seconds) * 100))}%</p>
          </>
        )}
        {mistake && <p role="alert">Не тот разъём. Начни заново.</p>}
        <button
          className="action"
          disabled={
            !ready ||
            (task.task_type !== "upload" &&
              solution.length !== task.challenge.length)
          }
          onClick={() => onComplete(solution)}
        >
          Подтвердить{ready ? "" : " · ждём терминал"}
        </button>
      </section>
    </div>
  );
}
