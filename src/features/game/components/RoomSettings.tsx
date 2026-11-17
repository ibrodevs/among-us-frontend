"use client";
import { useEffect, useState, useRef } from "react";
import { gameApi } from "@/lib/api";
export function RoomSettings({
  code,
  token,
  isHost,
  serverSettings,
  playerCount = 0,
}: {
  code: string;
  token: string;
  isHost: boolean;
  serverSettings?: Record<string, number | string | boolean>;
  playerCount?: number;
}) {
  const [settings, setSettings] = useState<Record<
      string,
      number | string | boolean
    > | null>(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const previousServer = useRef("");
  useEffect(() => {
    const key = JSON.stringify(serverSettings);
    if (serverSettings && key !== previousServer.current) {
      previousServer.current = key;
      setSettings(serverSettings);
    }
  }, [serverSettings]);
  useEffect(() => {
    let active = true;
    gameApi
      .getSettings(token, code)
      .then((s) => {
        if (active) setSettings(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token, code]);
  if (!settings) return <p role="status">{error || "Настройки станции…"}</p>;
  const change = (key: string, value: number | string | boolean) => {
    setSaved(false);
    setSettings((s) => ({ ...s, [key]: value }));
  };
  return (
    <details>
      <summary>
        Настройки матча ·{" "}
        {settings.map_version === 2 ? "Asterion" : "Орбита v1"}
      </summary>
      <fieldset disabled={!isHost}>
        <fieldset>
          <legend>Количество предателей</legend>
          <div className="row" role="group" aria-label="Количество предателей">
            {[1, 2, 3].map((count) => (
              <button
                type="button"
                className={
                  Number(settings.impostor_count) === count
                    ? "action"
                    : "action secondary"
                }
                key={count}
                aria-label={`Предателей: ${count}`}
                aria-pressed={Number(settings.impostor_count) === count}
                onClick={() => {
                  change("impostor_count", count);
                  gameApi
                    .saveSettings(token, code, { impostor_count: count })
                    .then((s) => {
                      setSettings(s);
                      setSaved(true);
                      setError("");
                    })
                    .catch((e) => {
                      setError(e.message);
                      void gameApi.getSettings(token, code).then(setSettings);
                    });
                }}
              >
                {count}
              </button>
            ))}
          </div>
          <p>
            Выбрано: {Number(settings.impostor_count) || 2} · Игроки:{" "}
            {playerCount} / {Number(settings.max_players)}
          </p>
          <p>
            {playerCount >=
            ({ 1: 4, 2: 7, 3: 10 }[
              Number(settings.impostor_count) as 1 | 2 | 3
            ] || 7)
              ? "Комната готова к старту"
              : `Для ${Number(settings.impostor_count) || 2} предателей требуется минимум ${{ 1: 4, 2: 7, 3: 10 }[Number(settings.impostor_count) as 1 | 2 | 3] || 7} игроков`}
          </p>
          <small>
            Рекомендация: {playerCount < 7 ? 1 : playerCount < 13 ? 2 : 3}.
            Решение принимает хозяин.
          </small>
        </fieldset>
        <label>
          Карта
          <select
            aria-label="Карта"
            value={String(settings.map_version)}
            onChange={(e) => change("map_version", Number(e.target.value))}
          >
            <option value="2">ASTERION · v2</option>
            <option value="1">Орбита · v1</option>
          </select>
        </label>
        <label>
          Область
          <select
            aria-label="Область"
            value={String(settings.area)}
            onChange={(e) => change("area", e.target.value)}
          >
            <option value="auto">Авто · 4–7 компактная / 8–20 полная</option>
            <option value="compact">Компактная</option>
            <option value="full">Полная</option>
          </select>
        </label>
        <div className="stack">
          {[
            ["max_players", "Максимум игроков", 4, 20],
            ["speed", "Скорость", 200, 230],
            ["discussion_seconds", "Обсуждение, с", 5, 120],
            ["voting_seconds", "Голосование, с", 5, 120],
            ["kill_cooldown", "Перезарядка убийства, с", 10, 60],
            ["critical_seconds", "Таймер критической аварии, с", 45, 120],
            ["common_tasks", "Общие задания", 0, 2],
            ["short_tasks", "Короткие задания", 1, 7],
            ["long_tasks", "Длинные задания", 0, 3],
            ["crew_vision", "Обзор экипажа", 250, 800],
            ["impostor_vision", "Обзор предателя", 350, 1000],
          ].map(([key, title, min, max]) => (
            <label key={key}>
              {title}
              <input
                type="number"
                min={min}
                max={max}
                value={Number(settings[key])}
                onChange={(e) => change(String(key), Number(e.target.value))}
              />
            </label>
          ))}
          {[
            ["special_roles", "Дополнительные роли"],
            ["anonymous_votes", "Анонимные голоса"],
            ["confirm_ejects", "Показывать роль исключённого"],
            ["self_vote", "Голосовать за себя"],
            ["critical_sabotages", "Критические аварии"],
            ["vents", "Люки"],
            ["ghost_tasks", "Задания призраков"],
            ["ghost_sabotage", "Саботаж призраков-предателей"],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={(e) => change(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <p>
          Сумма заданий:{" "}
          {Number(settings.common_tasks) +
            Number(settings.short_tasks) +
            Number(settings.long_tasks)}{" "}
          (4–9)
        </p>
        <button
          className="action secondary"
          type="button"
          onClick={() => {
            gameApi
              .saveSettings(token, code, settings)
              .then((s) => {
                setSettings(s);
                setError("");
                setSaved(true);
              })
              .catch((e) => setError(e.message));
          }}
        >
          Сохранить настройки
        </button>
      </fieldset>
      {saved && <p role="status">Настройки сохранены</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
