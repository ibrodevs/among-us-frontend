"use client";
import { useAudio } from "./AudioProvider";
import { useEffect, useRef } from "react";
import { StationAudio, type SoundName } from "./AudioManager";
import type { Snapshot, OwnState } from "../game/network/types";
export function EventSoundBridge({
  snapshot,
  own,
}: {
  snapshot: Snapshot;
  own: OwnState;
}) {
  const started = useRef(false),
    ejected = useRef<string | null>(null);
  const audio = useRef<StationAudio | null>(null),
    seen = useRef(new Set<string>()),
    previous = useRef({
      phase: snapshot.phase,
      alive: own.alive,
      sabotages: new Set<string>(),
      completed: snapshot.tasks_completed,
    });
  const motion = useRef({
    x: own.x || 0,
    y: own.y || 0,
    at: 0,
    vent: own.current_vent_id,
    doors: new Map<string, boolean>(),
    stages: new Map<string, number>(),
  });
  const { engine } = useAudio();
  audio.current = engine;
  useEffect(() => {
    const engine = audio.current;
    if (!engine) return;
    if (!started.current) {
      engine.play("game.start");
      started.current = true;
    }
    const nextEjected = snapshot.last_meeting_result?.ejected_player_id || null;
    if (nextEjected && ejected.current !== nextEjected) engine.play("ejection");
    ejected.current = nextEjected;
    for (const effect of snapshot.effects || []) {
      if (seen.current.has(effect.id)) continue;
      seen.current.add(effect.id);
      const name =
        effect.type === "kill"
          ? "kill"
          : effect.type === "vent.entered"
            ? "vent.enter"
            : effect.type === "vent.exited"
              ? "vent.exit"
              : null;
      if (name === "vent.enter")
        engine.play(
          "vent.open",
          effect,
          own.x === undefined ? undefined : { x: own.x, y: own.y || 0 },
        );
      if (name === "vent.exit")
        engine.play(
          "vent.close",
          effect,
          own.x === undefined ? undefined : { x: own.x, y: own.y || 0 },
        );
      if (name)
        engine.play(
          name,
          effect,
          own.x === undefined ? undefined : { x: own.x, y: own.y || 0 },
        );
    }
    if (seen.current.size > 200)
      seen.current = new Set((snapshot.effects || []).map((e) => e.id));
    const m = motion.current,
      at = Date.now();
    if (
      own.x !== undefined &&
      Math.hypot(own.x - m.x, (own.y || 0) - m.y) > 25 &&
      at - m.at > 350 &&
      !own.is_in_vent
    ) {
      engine.play("move.step");
      m.x = own.x;
      m.y = own.y || 0;
      m.at = at;
    }
    if (own.is_in_vent && own.current_vent_id !== m.vent && m.vent)
      engine.play("vent.travel");
    m.vent = own.current_vent_id;
    for (const door of snapshot.doors || []) {
      if (m.doors.has(door.id) && m.doors.get(door.id) !== door.closed)
        engine.play(
          door.closed ? "door.close" : "door.open",
          { x: door.bounds.x, y: door.bounds.y },
          own.x === undefined ? undefined : { x: own.x, y: own.y || 0 },
        );
      m.doors.set(door.id, door.closed);
    }
    for (const task of own.tasks) {
      const stage = task.stage || 0;
      if (m.stages.has(task.id) && stage > m.stages.get(task.id)!)
        engine.play("task.stage");
      m.stages.set(task.id, stage);
    }
    const p = previous.current;
    if (p.phase !== snapshot.phase)
      engine.play(
        snapshot.phase === "meeting"
          ? "meeting.start"
          : snapshot.phase === "finished"
            ? snapshot.result?.winner === own.role
              ? "game.win"
              : "game.lose"
            : "meeting.end",
      );
    if (p.alive && !own.alive) engine.play("ghost.spawn");
    if (snapshot.tasks_completed > p.completed) engine.play("task.success");
    for (const s of snapshot.sabotages || [])
      if (!p.sabotages.has(s.id))
        engine.play(("sabotage." + s.kind) as SoundName);
    if (p.sabotages.size > (snapshot.sabotages?.length || 0))
      engine.play("repair.success");
    previous.current = {
      phase: snapshot.phase,
      alive: own.alive,
      sabotages: new Set(snapshot.sabotages?.map((s) => s.id)),
      completed: snapshot.tasks_completed,
    };
    engine.setMood(
      snapshot.phase === "finished"
        ? snapshot.result?.winner === own.role
          ? "victory"
          : "defeat"
        : snapshot.phase === "meeting"
          ? "meeting"
          : snapshot.sabotages?.some(
                (s) => s.kind === "reactor" || s.kind === "oxygen",
              )
            ? "critical"
            : "exploration",
    );
  }, [snapshot, own, engine]);
  return null;
}
