"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, gameApi } from "@/lib/api";
import { clearGuest, readGuest } from "@/lib/guest";
import type { Room } from "@/lib/types";

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
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
        if (result.status !== "waiting") router.replace("/game/" + code);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) { clearGuest(); router.replace("/"); return; }
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
    setBusy(true);
    try { if (guest) await gameApi.leaveRoom(guest.token, code); router.push("/"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка выхода"); }
    finally { setBusy(false); }
  }
  return <main className="panel">
    <p className="muted">ЛОББИ</p>
    <h1 className="invite">{code}</h1>
    <button className="action secondary" onClick={() => { void navigator.clipboard.writeText(code).then(() => setCopied(true)).catch(() => setError("Не удалось скопировать код. Выдели его вручную.")); }}>{copied ? "Код скопирован ✓" : "Скопировать приглашение"}</button>
    <p className="subtitle">Отправь код друзьям. Минимум 4 игрока для старта.</p>
    <div className="stack">
      {room ? <>
        <p>Игроки: {room.players.length} / {room.max_players}</p>
        {room.players.map((player) => <div className="player row" key={player.id}><span className="player-name"><span className="avatar">{player.nickname.slice(0,1)}</span>{player.nickname}{player.id === guest?.player_id && " (ты)"}</span><span className="muted">{player.is_host ? "Хост" : "Игрок"}</span></div>)}
        {room.host_player_id === guest?.player_id && <button className="action" disabled={busy || room.players.length < room.min_players} onClick={() => void start()}>Начать игру</button>}
      </> : <p className="muted">Загрузка комнаты…</p>}
      <button className="action secondary" disabled={busy} onClick={() => void leave()}>Выйти из комнаты</button>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  </main>;
}
