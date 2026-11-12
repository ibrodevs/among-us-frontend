"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { gameApi } from "@/lib/api";
import { readGuest } from "@/lib/guest";
import type { Room } from "@/lib/types";

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const guest = readGuest();
    if (!guest) { router.replace("/"); return; }
    let active = true;
    async function refresh() {
      try {
        const result = await gameApi.getRoom(guest!.token, code);
        if (!active) return;
        setRoom(result); setError("");
        if (result.status === "playing" || result.status === "meeting") router.replace("/game/" + code);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Не удалось получить комнату");
      }
    }
    void refresh();
    const handle = window.setInterval(() => void refresh(), 2500);
    return () => { active = false; window.clearInterval(handle); };
  }, [code, router]);
  const guest = readGuest();
  async function start() {
    if (!guest) return;
    setBusy(true);
    try { await gameApi.startGame(guest.token, code); router.push("/game/" + code); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось запустить игру"); }
    finally { setBusy(false); }
  }
  async function leave() {
    if (guest) await gameApi.leaveRoom(guest.token, code).catch(() => undefined);
    router.push("/");
  }
  return <main className="panel">
    <p className="muted">ЛОББИ</p>
    <h1 className="brand">{code}</h1>
    <p className="subtitle">Отправь код друзьям. Минимум 4 игрока для старта.</p>
    <div className="stack">
      {room ? <>
        <p>Игроки: {room.players.length} / {room.max_players}</p>
        {room.players.map((player) => <div className="player row" key={player.id}><span>{player.nickname}</span><span className="muted">{player.is_host ? "Хост" : "Игрок"}</span></div>)}
        {room.host_player_id === guest?.player_id && <button className="action" disabled={busy || room.players.length < room.min_players} onClick={() => void start()}>Начать игру</button>}
      </> : <p className="muted">Загрузка комнаты…</p>}
      <button className="action secondary" onClick={() => void leave()}>Выйти из комнаты</button>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  </main>;
}
