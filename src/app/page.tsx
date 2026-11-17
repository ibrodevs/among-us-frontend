"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, gameApi } from "@/lib/api";
import { clearGuest, ensureGuest, readGuest } from "@/lib/guest";

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNickname(readGuest()?.nickname || "");
  }, []);

  async function run(mode: "create" | "join") {
    setBusy(true);
    setError("");
    if (mode === "join" && !/^[A-Z0-9]{6}$/.test(code.trim().toUpperCase())) {
      setError("Код должен содержать 6 букв или цифр");
      setBusy(false);
      return;
    }
    try {
      const guest = await ensureGuest(nickname || readGuest()?.nickname || "");
      const room =
        mode === "create"
          ? await gameApi.createRoom(guest.token)
          : await gameApi.joinRoom(guest.token, code.trim().toUpperCase());
      router.push("/room/" + room.code);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) clearGuest();
      setError(
        cause instanceof Error ? cause.message : "Ошибка подключения к серверу",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <nav className="nav">
        <Link className="wordmark" href="/">
          ✦ CREWMATE <span>X</span>
        </Link>
        <span className="badge">4–20 друзей · 1 миссия</span>
      </nav>
      <main>
        <section className="hero">
          {/* Original geometric expedition robots. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="hero-art"
            src="/crew.svg"
            alt="Команда роботов-исследователей готовится к космической миссии"
            width="560"
            height="480"
          />
          <div>
            <p className="eyebrow">Твоя команда. Твоя орбита.</p>
            <h1 className="brand">
              В космосе
              <br />
              доверяй <span>не всем.</span>
            </h1>
            <p className="subtitle">
              Спасайте станцию, выполняйте задания
              <br />и вычислите того, кто играет против вас.
            </p>
            <div className="stack" aria-busy={busy}>
              <label htmlFor="nickname">Как тебя зовут, капитан?</label>
              <input
                autoComplete="nickname"
                id="nickname"
                className="field"
                maxLength={16}
                placeholder="Никнейм · 2–16 символов"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <button
                className="action"
                disabled={busy || nickname.trim().length < 2}
                onClick={() => void run("create")}
              >
                {busy ? "Связываемся со станцией…" : "Создать комнату →"}
              </button>
              <label htmlFor="code" className="muted">
                Уже есть приглашение?
              </label>
              <div className="join-row">
                <input
                  id="code"
                  className="field"
                  maxLength={6}
                  autoCapitalize="characters"
                  placeholder="КОД"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button
                  className="action secondary"
                  disabled={
                    busy ||
                    code.trim().length !== 6 ||
                    nickname.trim().length < 2
                  }
                  onClick={() => void run("join")}
                >
                  Войти в экипаж
                </button>
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </div>
          </div>
        </section>
        <p style={{ textAlign: "center" }}>
          <Link className="action secondary" href="/demo/asterion">
            Исследовать Asterion · демо карты
          </Link>
        </p>
        <div className="facts">
          <div>
            <strong>4–20</strong>игроков в экипаже
          </div>
          <div>
            <strong>7 заданий</strong>на каждого исследователя
          </div>
          <div>
            <strong>1 вопрос</strong>кому ты доверяешь?
          </div>
        </div>
        <section className="how" aria-label="Как играть">
          <article>
            <h2>01 · Собери экипаж</h2>
            <p>
              Создай комнату и отправь друзьям код. Играть можно прямо в
              браузере.
            </p>
          </article>
          <article>
            <h2>02 · Выполни миссию</h2>
            <p>
              Исследуй станцию и ремонтируй системы. Предатель уже среди вас.
            </p>
          </article>
          <article>
            <h2>03 · Найди предателя</h2>
            <p>
              Обсуждайте подозрения на собрании. Каждый голос может изменить
              всё.
            </p>
          </article>
        </section>
      </main>
      <footer>CREWMATE X · Оригинальное космическое приключение</footer>
    </>
  );
}
