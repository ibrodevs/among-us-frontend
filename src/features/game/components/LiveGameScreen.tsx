"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gameApi } from "@/lib/api";
import { readGuest } from "@/lib/guest";
import { useRouter } from "next/navigation";
import { readDirection } from "../engine/input";
import { useGameInput } from "../hooks/useGameInput";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { LiveCanvas } from "./LiveCanvas";
import { GameControls } from "./GameHud";
import { TaskDialog } from "./TaskDialog";
import type { Task } from "../network/types";
import styles from "../game.module.css";
const taskNames = {
  wires: "Wire Link · Двигатели",
  sequence: "Sequence · Навигация",
  upload: "Upload · Связь",
};
const reasonNames: Record<string, string> = {
  parity: "Предатели достигли численного превосходства",
  tasks_completed: "Все системы станции восстановлены",
  impostors_eliminated: "Все предатели выведены из игры",
};
export function LiveGameScreen({ code }: { code: string }) {
  const net = useRoomSocket(code),
    { snapshot, own, playerId, status, send } = net;
  const router = useRouter();
  const [taskId, setTaskId] = useState<string | null>(null),
    [clock, setClock] = useState(0),
    [leaveError, setLeaveError] = useState("");
  const seq = useRef(Date.now());
  const closeTask = useCallback(() => setTaskId(null), []);
  const player = snapshot?.players.find((p) => p.id === playerId);
  const paused =
    status !== "connected" ||
    snapshot?.phase !== "playing" ||
    !player?.alive ||
    taskId !== null;
  const input = useGameInput(paused, closeTask);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (paused) return;
    let previous = "";
    const timer = setInterval(() => {
      const direction = readDirection(input.current);
      const key = direction.x + "," + direction.y;
      if (key === "0,0" && previous === key) return;
      seq.current = Math.max(seq.current + 1, Date.now());
      send({ type: "player.move", seq: seq.current, direction });
      previous = key;
    }, 100);
    return () => clearInterval(timer);
  }, [input, paused, send]);
  const task = own?.tasks.find((t) => t.id === taskId && !t.is_completed);
  const active = task?.started_at ? task : null;
  useEffect(() => {
    if (taskId && own?.tasks.find((t) => t.id === taskId)?.is_completed)
      setTaskId(null);
  }, [own, taskId]);
  const now = clock + net.serverOffset.current;
  const cooldown = Math.max(
    0,
    Math.ceil(
      ((own?.kill_available_at ? Date.parse(own.kill_available_at) : 0) - now) /
        1000,
    ),
  );
  const distance = (point: { x: number; y: number }) =>
    player ? Math.hypot(player.x - point.x, player.y - point.y) : Infinity;
  const nearbyTask = own?.tasks.find(
    (t) => !t.is_completed && distance(t) <= 85,
  );
  const body = snapshot?.bodies.find((b) => distance(b) <= 110);
  const target = snapshot?.players
    .filter((p) => p.alive && p.id !== playerId && distance(p) <= 90)
    .sort((a, b) => distance(a) - distance(b))[0];
  const beginTask = (t: Task) => {
    if (send({ type: "task.begin", task_id: t.id })) setTaskId(t.id);
  };
  async function leave() {
    try {
      const guest = readGuest();
      if (guest) await gameApi.leaveRoom(guest.token, code);
      router.push("/");
    } catch (cause) {
      setLeaveError(cause instanceof Error ? cause.message : "Ошибка выхода");
    }
  }
  if (status === "unauthorized")
    return (
      <main className="panel stack">
        <h1>Сессия недоступна</h1>
        <p>Войди заново. Токен истёк или у тебя нет доступа к этой комнате.</p>
        <Link className="action" href="/">
          В главное меню
        </Link>
      </main>
    );
  if (!snapshot || !own)
    return (
      <main className="panel stack">
        <h1>Связь со станцией…</h1>
        <p role="status">
          {status === "reconnecting"
            ? "Восстанавливаем соединение"
            : "Загружаем состояние матча"}
        </p>
        {net.error && <p role="alert">{net.error}</p>}
        <Link className="action secondary" href={"/room/" + code}>
          Вернуться в лобби
        </Link>
      </main>
    );
  if (snapshot.phase === "finished" && snapshot.result)
    return (
      <main className="panel stack">
        <p className="eyebrow">Миссия завершена</p>
        <h1 className="brand">
          {snapshot.result.winner === "crew"
            ? "Победа экипажа!"
            : "Победа предателей!"}
        </h1>
        <p>{reasonNames[snapshot.result.reason] || snapshot.result.reason}</p>
        {snapshot.result.players_with_roles.map((p) => (
          <div className="player row" key={p.id}>
            <strong>{p.nickname}</strong>
            <span>{p.role === "crew" ? "Экипаж" : "Предатель"}</span>
          </div>
        ))}
        <button className="action" onClick={() => void leave()}>
          Вернуться в главное меню
        </button>
        {leaveError && <p role="alert">{leaveError}</p>}
      </main>
    );
  const meeting = snapshot.meeting;
  const meetingSeconds = meeting
    ? Math.max(0, Math.ceil((Date.parse(meeting.deadline_at) - now) / 1000))
    : 0;
  return (
    <main className={styles.screen}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Crew Mission · {code}</p>
            <h1>Станция «Орбита»</h1>
          </div>
          <div className={styles.headerActions}>
            <span className="badge" role="status">
              {status === "connected"
                ? `Онлайн${net.ping !== null ? " · " + net.ping + " мс" : ""}`
                : "Переподключение…"}
            </span>
            <button className="action secondary" onClick={() => void leave()}>
              Выйти
            </button>
          </div>
        </header>
        {status !== "connected" && (
          <p className="error" role="status">
            Связь потеряна. Восстанавливаем прежний матч…
          </p>
        )}
        {(net.error || leaveError) && (
          <p className="error" role="alert">
            {net.error || leaveError}
          </p>
        )}
        <div className={styles.layout}>
          <section className={styles.play} aria-label="Игровая карта">
            <div className={styles.playHeader}>
              <strong>{player?.nickname}</strong>
              <span className="badge">
                {!player?.alive
                  ? "Режим наблюдения"
                  : own.role === "crew"
                    ? "Экипаж"
                    : "Предатель"}
              </span>
            </div>
            <div className={styles.viewport}>
              <LiveCanvas snapshot={snapshot} playerId={playerId} />
            </div>
            <GameControls input={input} paused={paused} />
            <div className="game-actions">
              {own.role === "crew" && (
                <button
                  className="action"
                  disabled={paused || !nearbyTask}
                  onClick={() => nearbyTask && beginTask(nearbyTask)}
                >
                  Использовать
                </button>
              )}
              {own.role === "impostor" && (
                <button
                  className="action"
                  disabled={paused || !target || cooldown > 0}
                  onClick={() =>
                    target &&
                    send({ type: "player.kill", target_player_id: target.id })
                  }
                >
                  Устранить{cooldown ? " · " + cooldown + "с" : ""}
                </button>
              )}
              <button
                className="action secondary"
                disabled={paused || !body}
                onClick={() =>
                  body && send({ type: "body.report", body_id: body.id })
                }
              >
                Сообщить о теле
              </button>
              <button
                className="action secondary"
                disabled={
                  paused ||
                  own.emergency_used ||
                  distance({ x: 800, y: 450 }) > 85
                }
                onClick={() => send({ type: "meeting.call" })}
              >
                Собрание {!own.emergency_used ? "(1)" : "(0)"}
              </button>
            </div>
          </section>
          <aside className={`${styles.hud} ${styles.liveHud}`}>
            <h2>Состояние миссии</h2>
            <p>
              {snapshot.tasks_completed} / {snapshot.tasks_total} заданий
            </p>
            <div className="bar">
              <div
                style={{
                  width:
                    (snapshot.tasks_total
                      ? (snapshot.tasks_completed / snapshot.tasks_total) * 100
                      : 0) + "%",
                }}
              />
            </div>
            <div className="stack">
              {own.role === "crew" ? (
                own.tasks.map((t) => (
                  <button
                    className="action secondary"
                    key={t.id}
                    disabled={paused || t.is_completed || distance(t) > 85}
                    onClick={() => beginTask(t)}
                  >
                    {t.is_completed ? "✓ " : "○ "}
                    {taskNames[t.task_type]}
                  </button>
                ))
              ) : (
                <p>
                  Останься незамеченным. Устраняй экипаж рядом с собой.
                  Перезарядка — 25 секунд.
                </p>
              )}
              <p className="muted">
                Терминалы отмечены на карте. Центральный пульт «!» созывает
                собрание.
              </p>
              <h2>Экипаж</h2>
              {snapshot.players.map((p) => (
                <div className="row" key={p.id}>
                  <span>{p.nickname}</span>
                  <span className="muted">
                    {p.alive ? "На борту" : "Наблюдает"}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
        {active && snapshot.phase === "playing" && player?.alive && (
          <TaskDialog
            key={active.id}
            task={active}
            now={now}
            onClose={closeTask}
            onComplete={(solution) => {
              send({ type: "task.complete", task_id: active.id, solution });
            }}
          />
        )}
        {meeting && (
          <div className="modal-backdrop">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="meeting-title"
            >
              <p className="eyebrow">Общий сбор · {meetingSeconds} с</p>
              <h2 id="meeting-title">
                {meeting.stage === "discussion"
                  ? "Кому можно доверять?"
                  : meeting.stage === "voting"
                    ? "Время голосовать"
                    : "Результат голосования"}
              </h2>
              {meeting.stage === "discussion" && (
                <p>
                  Обсудите подозрения с друзьями по своей связи. Через{" "}
                  {meetingSeconds} с откроется голосование.
                </p>
              )}
              {meeting.stage === "voting" && (
                <>
                  <p>
                    {meeting.votes_cast} / {meeting.alive_voters} голосов
                    принято
                  </p>
                  <div className="stack">
                    {snapshot.players
                      .filter((p) => p.alive)
                      .map((p) => (
                        <button
                          className="action secondary"
                          key={p.id}
                          disabled={
                            own.has_voted ||
                            !player?.alive ||
                            status !== "connected"
                          }
                          onClick={() =>
                            send({ type: "vote.cast", target_player_id: p.id })
                          }
                        >
                          {p.nickname}
                          {p.id === playerId ? " (ты)" : ""}
                        </button>
                      ))}
                    <button
                      className="action"
                      disabled={
                        own.has_voted ||
                        !player?.alive ||
                        status !== "connected"
                      }
                      onClick={() =>
                        send({ type: "vote.cast", target_player_id: null })
                      }
                    >
                      Пропустить
                    </button>
                  </div>
                  {own.has_voted && <p role="status">Твой голос принят</p>}
                </>
              )}
              {meeting.stage === "result" && (
                <>
                  <h3>
                    {meeting.result.ejected_player_id
                      ? `${snapshot.players.find((p) => p.id === meeting.result.ejected_player_id)?.nickname} покидает станцию`
                      : "Никто не исключён"}
                  </h3>
                  <p>
                    При равенстве голосов или победе Skip все остаются на борту.
                  </p>
                  {Object.entries(meeting.result.counts).map(([id, count]) => (
                    <p key={id}>
                      {id === "skip"
                        ? "Skip"
                        : snapshot.players.find((p) => p.id === id)?.nickname}
                      : {count}
                    </p>
                  ))}
                </>
              )}
              {!player?.alive && (
                <p className="badge">
                  Режим наблюдения · голосование недоступно
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
