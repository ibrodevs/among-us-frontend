"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gameApi } from "@/lib/api";
import { readGuest } from "@/lib/guest";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { useGameInput } from "../hooks/useGameInput";
import { readDirection } from "../engine/input";
import { station } from "../engine/asterion-renderer";
import { Ejection } from "./Ejection";
import { RepairPanel } from "./RepairPanel";
import { EventSoundBridge as AudioControls } from "../../audio/EventSoundBridge";
import { AsterionCanvas } from "./AsterionCanvas";
import { AsterionTask } from "./AsterionTask";
import { StationMap } from "./StationMap";
import { GameControls } from "./GameHud";
import { sound } from "../../audio/events";
import css from "./asterion.module.css";
export function AsterionScreen({
  code,
  net,
}: {
  code: string;
  net: ReturnType<typeof useRoomSocket>;
}) {
  const { snapshot, own, playerId, send, status } = net;
  const router = useRouter();
  const [clock, setClock] = useState(0),
    [taskId, setTaskId] = useState<string | null>(null),
    [map, setMap] = useState<"normal" | "tactical" | null>(null),
    [chat, setChat] = useState(""),
    [holding, setHolding] = useState(false),
    [abilityTarget, setAbilityTarget] = useState(""),
    [leaveError, setLeaveError] = useState("");
  useEffect(() => {
    if (net.error) sound("ui.error");
  }, [net.error]);
  const close = useCallback(() => {
    setTaskId(null);
    setMap(null);
    setHolding(false);
  }, []);
  const paused =
    status !== "connected" ||
    snapshot?.phase !== "playing" ||
    Boolean(taskId || map || own?.is_in_vent || own?.observation);
  const input = useGameInput(paused, close),
    seq = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 100);
    const key = (e: KeyboardEvent) => {
      if (
        e.code === "KeyM" &&
        !e.repeat &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        setMap((v) => (v ? null : "normal"));
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", key);
    };
  }, []);
  const moving = useRef(false),
    lastNonzero = useRef(0);
  useEffect(() => {
    const push = (direction: { x: number; y: number }) => {
      seq.current = Math.max(seq.current + 1, Date.now());
      moving.current = Boolean(direction.x || direction.y);
      send({ type: "player.move", seq: seq.current, direction });
    };
    if (paused) {
      if (
        moving.current &&
        !own?.is_in_vent &&
        snapshot?.phase === "playing" &&
        status === "connected"
      )
        push({ x: 0, y: 0 });
      return;
    }
    let previous = "";
    const flush = () => {
      const direction = readDirection(input.current),
        key = direction.x + "," + direction.y;
      if (key === "0,0" && previous === key) return;
      if (key !== "0,0") {
        if (performance.now() - lastNonzero.current < 95) return;
        lastNonzero.current = performance.now();
      }
      push(direction);
      previous = key;
    };
    const release = () => {
      const direction = readDirection(input.current);
      if (!direction.x && !direction.y && moving.current) flush();
    };
    const id = setInterval(flush, 100);
    const press = (e: KeyboardEvent) => {
      if (
        !e.repeat &&
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      )
        flush();
    };
    window.addEventListener("keydown", press);
    window.addEventListener("keyup", release);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", press);
      window.removeEventListener("keyup", release);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [paused, send, input, own?.is_in_vent, snapshot?.phase, status]);
  const task = own?.tasks.find((t) => t.id === taskId && !t.is_completed);
  const hadAttempt = useRef(false);
  useEffect(() => {
    if (task?.started_at) hadAttempt.current = true;
    else if (hadAttempt.current) {
      hadAttempt.current = false;
      setTaskId(null);
    }
  }, [taskId, task?.started_at]);
  const repair = own?.repair;
  const repairId = repair?.sabotage_id,
    repairPanel = repair?.panel_id;
  useEffect(() => {
    if (!holding || !repairId || !repairPanel) return;
    const id = setInterval(
      () =>
        send({
          type: "sabotage.repair.begin",
          sabotage_id: repairId,
          panel_id: repairPanel,
        }),
      400,
    );
    return () => clearInterval(id);
  }, [holding, repairId, repairPanel, send]);
  if (!snapshot || !own) return null;
  const now = clock + net.serverOffset.current,
    player = snapshot.players.find((p) => p.id === playerId),
    distance = (p: { x: number; y: number }) =>
      Math.hypot((own.x || 0) - p.x, (own.y || 0) - p.y);
  const nearbyTask = own.tasks.find(
      (t) => !t.is_completed && distance(t) <= 85,
    ),
    vent = station.vents.find((v) => distance(v) <= 75),
    body = snapshot.bodies.find((b) => distance(b) <= 110),
    target = snapshot.players.find(
      (p) => p.id !== playerId && p.alive && distance(p) <= 90,
    ),
    terminal = station.terminals.find((t) => distance(t) <= 100),
    door = station.doors.find(
      (d) =>
        distance({
          x: d.bounds.x + d.bounds.width / 2,
          y: d.bounds.y + d.bounds.height / 2,
        }) <= 110,
    );
  const panel = snapshot.sabotages
    ?.flatMap((s) =>
      s.panels
        .filter((p) => !s.repaired_panels.includes(p.id))
        .map((p) => ({ ...p, sabotage_id: s.id, kind: s.kind })),
    )
    .find((p) => distance(p) <= 90);
  const killCooldown =
    Math.max(
      0,
      Math.ceil((Date.parse(own.kill_available_at || "") - now) / 1000),
    ) || 0;
  const begin = (id: string) => {
    if (send({ type: "task.begin", task_id: id })) setTaskId(id);
  };
  const leave = async () => {
    try {
      const g = readGuest();
      if (g) await gameApi.leaveRoom(g.token, code);
      router.push("/");
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : "Ошибка выхода");
    }
  };
  if (snapshot.phase === "finished")
    return (
      <main className={`panel stack ${css.screen}`}>
        <AudioControls key="audio" snapshot={snapshot} own={own} />
        {snapshot.last_meeting_result?.ejected_player_id &&
          Date.parse(snapshot.last_meeting_result.presentation_until || "") >
            now && (
            <Ejection
              nickname={
                snapshot.roster?.find(
                  (p) =>
                    p.id === snapshot.last_meeting_result?.ejected_player_id,
                )?.nickname || ""
              }
              color={
                snapshot.roster?.find(
                  (p) =>
                    p.id === snapshot.last_meeting_result?.ejected_player_id,
                )?.color || 0
              }
              role={snapshot.last_meeting_result.ejected_role}
            />
          )}
        <p className="eyebrow">ASTERION · Миссия завершена</p>
        <h1>
          {snapshot.result?.winner === "crew"
            ? "Победа экипажа"
            : "Победа предателей"}
        </h1>
        <p>{snapshot.result?.reason}</p>
        {snapshot.result?.players_with_roles.map((p) => (
          <p key={p.id}>
            {p.nickname} · {p.role}
          </p>
        ))}
        <button className="action" onClick={() => void leave()}>
          В главное меню
        </button>
        {leaveError && <p role="alert">{leaveError}</p>}
      </main>
    );
  return (
    <main className={css.screen}>
      <AudioControls key="audio" snapshot={snapshot} own={own} />
      <header className="row">
        <div>
          <p className="eyebrow">
            CREW MISSION · {code} ·{" "}
            {snapshot.map_mode === "compact"
              ? "КОМПАКТНАЯ СТАНЦИЯ"
              : "ПОЛНАЯ СТАНЦИЯ"}
          </p>
          <h1>ASTERION</h1>
        </div>
        <div className={css.actions}>
          <span role="status">
            {status === "connected"
              ? `Онлайн · ${net.ping ?? "—"} мс`
              : "Переподключение…"}
          </span>
          <button className="action secondary" onClick={() => setMap("normal")}>
            Карта · M
          </button>
          <button className="action secondary" onClick={() => void leave()}>
            Выйти
          </button>
        </div>
      </header>
      {(net.error || leaveError) && (
        <p role="alert" className={css.alert}>
          {net.error || leaveError}
        </p>
      )}
      {snapshot.sabotages?.map((s) => (
        <div key={s.id} className={css.alert}>
          Авария: {s.kind}{" "}
          {s.deadline_at
            ? `· ${Math.max(0, Math.ceil((Date.parse(s.deadline_at) - now) / 1000))} с`
            : ""}{" "}
          · Найдите отмеченные на карте панели
        </div>
      ))}
      <div className={css.layout}>
        <section>
          <div className="row">
            <strong>{player?.nickname}</strong>
            <span>
              {own.alive
                ? own.role === "crew"
                  ? "Экипаж"
                  : "Предатель"
                : "Призрак · задания доступны"}{" "}
              {own.special_role && `· ${own.special_role}`}
            </span>
          </div>
          <div className={css.viewport}>
            <AsterionCanvas snapshot={snapshot} playerId={playerId} />
          </div>
          <GameControls
            input={input}
            paused={paused}
            escapeLabel="Закрыть панель"
          />
          <div className={css.actions}>
            {own.role === "crew" && (
              <button
                className="action"
                disabled={paused || !nearbyTask}
                onClick={() => nearbyTask && begin(nearbyTask.id)}
              >
                Использовать
              </button>
            )}
            {own.role === "impostor" && (
              <>
                <button
                  className="action"
                  disabled={paused || !own.alive || !target || killCooldown > 0}
                  onClick={() =>
                    target &&
                    send({ type: "player.kill", target_player_id: target.id })
                  }
                >
                  Устранить {killCooldown > 0 ? `· ${killCooldown} с` : ""}
                </button>
                <button
                  className="action secondary"
                  disabled={status !== "connected"}
                  onClick={() => setMap("tactical")}
                >
                  Саботаж
                </button>
              </>
            )}
            {(own.role === "impostor" || own.special_role === "technician") && (
              <button
                className="action secondary"
                disabled={
                  !own.alive ||
                  status !== "connected" ||
                  (!vent && !own.is_in_vent)
                }
                onClick={() =>
                  own.is_in_vent
                    ? send({ type: "vent.exit" })
                    : vent && send({ type: "vent.enter", vent_id: vent.id })
                }
              >
                {own.is_in_vent ? "Выйти из люка" : "Люк"}
              </button>
            )}
            <button
              className="action secondary"
              disabled={paused || !own.alive || !body}
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
                !own.alive ||
                own.emergency_used ||
                distance(station.emergency) > 85 ||
                snapshot.sabotages?.some(
                  (s) => s.kind === "oxygen" || s.kind === "reactor",
                )
              }
              onClick={() => send({ type: "meeting.call" })}
            >
              Собрание
            </button>
            {terminal && (
              <button
                className="action secondary"
                disabled={paused || !own.alive}
                onClick={() =>
                  send({ type: "terminal.use", terminal_id: terminal.id })
                }
              >
                Терминал · {terminal.type}
              </button>
            )}
            {door && (
              <button
                className="action secondary"
                disabled={paused || !own.alive}
                onClick={() =>
                  send({ type: "door.interact", door_id: door.id })
                }
              >
                Дверь
              </button>
            )}
            {panel && (
              <button
                className="action"
                disabled={paused || !own.alive}
                onClick={() => {
                  send({
                    type: "sabotage.repair.begin",
                    sabotage_id: panel.sabotage_id,
                    panel_id: panel.id,
                  });
                }}
              >
                Ремонт · {panel.kind}
              </button>
            )}
          </div>
          {own.is_in_vent && (
            <section className={css.terminal}>
              <h2>Сеть тоннелей</h2>
              <p>Текущее положение: {own.current_vent_id}</p>
              <div className={css.actions}>
                {own.vent_connections?.map((v) => (
                  <button
                    key={v.id}
                    className="action"
                    onClick={() => send({ type: "vent.travel", vent_id: v.id })}
                  >
                    {station.rooms.find((r) => r.id === v.room_id)?.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          {repair &&
            snapshot.sabotages?.some((s) => s.id === repair.sabotage_id) &&
            distance(
              station.sabotage_panels.find((p) => p.id === repair.panel_id)!,
            ) <= 90 && (
              <section className={css.terminal}>
                <h2>Восстановление · {repair.kind}</h2>
                {repair.kind === "reactor" ? (
                  <>
                    <p>
                      Удерживайте панель. Второй игрок должен удерживать другую
                      панель одновременно.
                    </p>
                    <button
                      className="action"
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setHolding(true);
                      }}
                      onPointerUp={() => setHolding(false)}
                      onPointerCancel={() => setHolding(false)}
                      onLostPointerCapture={() => setHolding(false)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter")
                          setHolding(true);
                      }}
                      onKeyUp={() => setHolding(false)}
                      onBlur={() => setHolding(false)}
                    >
                      {holding ? "Удерживается…" : "Удерживать"}
                    </button>
                  </>
                ) : (
                  <RepairPanel
                    key={repair.sabotage_id + repair.panel_id}
                    repair={repair}
                    send={send}
                  />
                )}
              </section>
            )}
          {own.observation && (
            <section className={css.terminal}>
              <h2>Терминал · {own.observation.type}</h2>
              <button
                className="action secondary"
                onClick={() => send({ type: "terminal.use", terminal_id: "" })}
              >
                Закрыть терминал
              </button>
              {own.observation.type === "admin" &&
                Object.entries(own.observation.counts || {}).map(([id, n]) => (
                  <p key={id}>
                    {station.rooms.find((r) => r.id === id)?.name}: {n}
                  </p>
                ))}
              {own.observation.type === "vitals" &&
                own.observation.players?.map((p) => (
                  <p key={p.id}>
                    {snapshot.roster?.find((r) => r.id === p.id)?.nickname}:{" "}
                    {p.status}
                  </p>
                ))}
              {own.observation.type === "cameras" && (
                <>
                  <label>
                    Камера
                    <select
                      value={own.observation.camera?.id}
                      onChange={(e) =>
                        send({
                          type: "terminal.use",
                          terminal_id: "security",
                          camera_id: e.target.value,
                        })
                      }
                    >
                      {station.cameras.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <svg
                    viewBox={`${(own.observation.camera?.x || 0) - 550} ${(own.observation.camera?.y || 0) - 550} 1100 1100`}
                    className={css.map}
                  >
                    {station.rooms.map((r) => (
                      <rect
                        key={r.id}
                        {...r.bounds}
                        fill="#213a50"
                        stroke="#789"
                      />
                    ))}
                    {own.observation.players?.map((p) => (
                      <g key={p.id}>
                        <circle cx={p.x} cy={p.y} r="25" fill="#7be5d0" />
                        <text
                          x={p.x}
                          y={(p.y || 0) - 40}
                          fill="#fff"
                          fontSize="35"
                        >
                          {p.nickname}
                        </text>
                      </g>
                    ))}
                  </svg>
                </>
              )}
            </section>
          )}
        </section>
        <aside className={css.aside}>
          <h2>Миссия</h2>
          {own.communications_down && (
            <p role="status">Связь отключена: задания скрыты до ремонта.</p>
          )}
          <p>
            {snapshot.tasks_completed} / {snapshot.tasks_total} заданий
          </p>
          <progress
            max={snapshot.tasks_total || 1}
            value={snapshot.tasks_completed}
          />
          {own.tasks.map((t) => (
            <button
              className="action secondary"
              key={t.id}
              disabled={paused || t.is_completed || distance(t) > 85}
              onClick={() => begin(t.id)}
            >
              {t.is_completed ? "✓" : "○"} {t.title} · {(t.stage || 0) + 1}/
              {t.stage_total || 1}
            </button>
          ))}
          {own.special_role && (
            <>
              <h3>{own.special_role}</h3>
              <select
                aria-label="Цель способности"
                value={abilityTarget}
                onChange={(e) => setAbilityTarget(e.target.value)}
              >
                <option value="">Выберите игрока</option>
                {snapshot.roster
                  ?.filter((p) => p.id !== playerId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nickname}
                    </option>
                  ))}
              </select>
              <button
                className="action"
                disabled={
                  !abilityTarget ||
                  (own.ability_available_at
                    ? Date.parse(own.ability_available_at) > now
                    : false)
                }
                onClick={() =>
                  send({
                    type: "player.ability.use",
                    target_player_id: abilityTarget,
                  })
                }
              >
                Применить способность
              </button>
              {Boolean(own.ability_state?.tracking) && (
                <p>
                  Последняя зона:{" "}
                  {String(
                    (own.ability_state?.tracking as { room_id: string })
                      .room_id || "неизвестна",
                  )}
                </p>
              )}
            </>
          )}
          <p className="muted">
            M — карта · Esc — закрыть панель. После гибели продолжайте выполнять
            задания.
          </p>
        </aside>
      </div>
      {map && (
        <StationMap
          snapshot={snapshot}
          own={own}
          tactical={map === "tactical"}
          send={send}
          onClose={close}
        />
      )}
      {task?.started_at && snapshot.phase === "playing" && (
        <AsterionTask
          key={`${task.id}-${task.stage}`}
          task={task}
          now={now}
          onClose={close}
          onComplete={(solution) =>
            send({ type: "task.complete", task_id: task.id, solution })
          }
        />
      )}
      {snapshot.meeting && (
        <div className="modal-backdrop">
          <section
            className={`modal ${css.task}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-v2"
          >
            <h2 id="meeting-v2">
              {snapshot.meeting.stage === "discussion"
                ? "Обсуждение"
                : snapshot.meeting.stage === "voting"
                  ? "Голосование"
                  : "Результат"}{" "}
              ·{" "}
              {Math.max(
                0,
                Math.ceil(
                  (Date.parse(snapshot.meeting.deadline_at) - now) / 1000,
                ),
              )}{" "}
              с
            </h2>
            <p>{own.alive ? "Канал живых игроков" : "Канал призраков"}</p>
            <div className={css.chat} aria-live="polite">
              {snapshot.meeting.messages?.map((m) => (
                <p key={m.id}>
                  <strong>{m.nickname}: </strong>
                  {m.text}
                </p>
              ))}
            </div>
            {snapshot.meeting.stage !== "result" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    chat.trim() &&
                    send({ type: "meeting.chat.send", text: chat })
                  )
                    setChat("");
                }}
              >
                <label>
                  Сообщение
                  <input
                    maxLength={500}
                    value={chat}
                    onChange={(e) => setChat(e.target.value)}
                  />
                </label>
                <button className="action" disabled={!chat.trim()}>
                  Отправить
                </button>
              </form>
            )}
            {snapshot.meeting.stage === "voting" && (
              <div className={css.grid}>
                {snapshot.players
                  .filter(
                    (p) =>
                      p.alive &&
                      (snapshot.settings?.self_vote !== false ||
                        p.id !== playerId),
                  )
                  .map((p) => (
                    <button
                      key={p.id}
                      className="action secondary"
                      disabled={!own.alive || own.has_voted}
                      onClick={() =>
                        send({ type: "vote.cast", target_player_id: p.id })
                      }
                    >
                      {p.nickname}
                    </button>
                  ))}
                <button
                  className="action"
                  disabled={!own.alive || own.has_voted}
                  onClick={() =>
                    send({ type: "vote.cast", target_player_id: null })
                  }
                >
                  Пропустить
                </button>
                <p>
                  Принято голосов: {snapshot.meeting.votes_cast}/
                  {snapshot.meeting.alive_voters}
                </p>
              </div>
            )}
            {snapshot.meeting.stage === "result" &&
              snapshot.meeting.result.ejected_player_id && (
                <Ejection
                  nickname={
                    snapshot.roster?.find(
                      (p) =>
                        p.id === snapshot.meeting?.result.ejected_player_id,
                    )?.nickname || ""
                  }
                  color={
                    snapshot.roster?.find(
                      (p) =>
                        p.id === snapshot.meeting?.result.ejected_player_id,
                    )?.color || 0
                  }
                  role={snapshot.meeting.result.ejected_role}
                />
              )}
            {snapshot.meeting.stage === "result" && (
              <p>
                {snapshot.meeting.result.ejected_player_id
                  ? `${snapshot.roster?.find((p) => p.id === snapshot.meeting?.result.ejected_player_id)?.nickname} покидает станцию`
                  : "Никто не исключён"}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
