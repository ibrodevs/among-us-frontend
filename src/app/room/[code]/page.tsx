"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ApiError, gameApi } from "@/lib/api";
import { clearGuest, readGuest } from "@/lib/guest";
import { sound } from "@/features/audio/events";
import { ColorPicker } from "@/features/game/components/ColorPicker";
import { RoomSettings } from "@/features/game/components/RoomSettings";
import { useRoomSocket } from "@/features/game/hooks/useRoomSocket";
import { PlayerBadge } from "@/features/game/components/PlayerBadge";
import type { Room } from "@/lib/types";

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const net = useRoomSocket(code);
  useEffect(() => {
    if (net.room) {
      setRoom(net.room);
      if (net.room.status !== "waiting") router.replace("/game/" + code);
    }
  }, [net.room, router, code]);
  const previousCount = useRef(0);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const guest = readGuest();
    if (!guest) {
      router.replace("/");
      return;
    }
    let active = true;
    async function refresh() {
      try {
        const result = await gameApi.getRoom(guest!.token, code);
        if (!active) return;
        if (
          previousCount.current &&
          previousCount.current !== result.players.length
        )
          sound(
            previousCount.current < result.players.length
              ? "room.join"
              : "room.leave",
          );
        previousCount.current = result.players.length;
        setRoom(result);
        setError("");
        if (result.status !== "waiting") router.replace("/game/" + code);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          clearGuest();
          router.replace("/");
          return;
        }
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Не удалось получить комнату",
          );
      }
    }
    void refresh();
    const handle = window.setInterval(() => void refresh(), 10000);
    return () => {
      active = false;
      window.clearInterval(handle);
    };
  }, [code, router]);
  const guest = readGuest();
  async function start() {
    if (!guest) return;
    setBusy(true);
    try {
      await gameApi.startGame(guest.token, code);
      router.push("/game/" + code);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось запустить игру",
      );
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    try {
      if (guest) await gameApi.leaveRoom(guest.token, code);
      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка выхода");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="panel">
      <p className="muted">CREWMATE X · ЛОББИ</p>
      <h1 className="invite">{code}</h1>
      <button
        className="action secondary"
        onClick={() => {
          void navigator.clipboard
            .writeText(code)
            .then(() => setCopied(true))
            .catch(() =>
              setError("Не удалось скопировать код. Выдели его вручную."),
            );
        }}
      >
        {copied ? "Код скопирован ✓" : "Скопировать приглашение"}
      </button>
      <p className="subtitle">
        Отправь код друзьям. До 20 игроков; минимум для старта зависит от
        количества предателей.
      </p>
      <div className="stack">
        {room ? (
          <>
            {guest && (
              <ColorPicker
                code={code}
                token={guest.token}
                playerId={guest.player_id}
              />
            )}
            {guest && (
              <RoomSettings
                code={code}
                token={guest.token}
                serverSettings={room.settings}
                playerCount={room.players.length}
                isHost={room.players.some(
                  (p) => p.id === guest.player_id && p.is_host,
                )}
              />
            )}
            <p>
              Игроки: {room.players.length} / {room.max_players}
            </p>
            <div className="lobby-grid">
              {room.players.map((player) => (
                <article className="player lobby-card" key={player.id}>
                  <PlayerBadge
                    color={player.color ?? room.players.indexOf(player)}
                  />
                  <div>
                    <strong>
                      {player.nickname}
                      {player.id === guest?.player_id && " (ты)"}
                    </strong>
                    <p className="muted">
                      {player.is_host ? "Хозяин" : "Участник"} ·{" "}
                      {player.is_connected ? "Онлайн" : "Переподключается"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <p role="status">
              {room.players.length >= room.min_players
                ? "Комната готова к старту"
                : `Для ${Number(room.settings?.impostor_count) || 2} предателей требуется минимум ${room.min_players} игроков`}
            </p>
            {room.host_player_id === guest?.player_id && (
              <button
                className="action"
                disabled={busy || room.players.length < room.min_players}
                onClick={() => void start()}
              >
                Начать игру
              </button>
            )}
          </>
        ) : (
          <p className="muted">Загрузка комнаты…</p>
        )}
        <button
          className="action secondary"
          disabled={busy}
          onClick={() => void leave()}
        >
          Выйти из комнаты
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
