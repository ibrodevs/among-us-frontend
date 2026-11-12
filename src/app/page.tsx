"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { gameApi } from "@/lib/api";
import { ensureGuest, readGuest } from "@/lib/guest";

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(mode: "create" | "join") {
    setBusy(true); setError("");
    try {
      const guest = await ensureGuest(nickname || readGuest()?.nickname || "");
      const room = mode === "create"
        ? await gameApi.createRoom(guest.token)
        : await gameApi.joinRoom(guest.token, code.trim().toUpperCase());
      router.push("/room/" + room.code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка подключения к серверу");
    } finally { setBusy(false); }
  }
  return (
    <main className="panel">
      <p className="muted">ONLINE SOCIAL DEDUCTION</p>
      <h1 className="brand">CREW MISSION</h1>
      <p className="subtitle">Собери команду, выполни задания и найди предателя.</p>
      <div className="stack">
        <label htmlFor="nickname">Имя игрока</label>
        <input id="nickname" className="field" maxLength={16} placeholder="Введите никнейм (2–16)" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        <button className="action" disabled={busy} onClick={() => void run("create")}>Создать комнату</button>
        <label htmlFor="code">Код приглашения</label>
        <input id="code" className="field" maxLength={6} placeholder="Например, AB12CD" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button className="action secondary" disabled={busy || code.trim().length !== 6} onClick={() => void run("join")}>Присоединиться</button>
        {error && <p role="alert" className="error">{error}</p>}
      </div>
    </main>
  );
}
