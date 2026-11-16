"use client";

import Link from "next/link";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { readGuest } from "@/lib/guest";
import type { GamePhase } from "../engine/types";
import { useGameInput } from "../hooks/useGameInput";
import styles from "../game.module.css";
import { GameCanvas } from "./GameCanvas";
import { GameControls, GameHud } from "./GameHud";
import { Icon } from "./Icon";

function subscribeToGuest(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function GameScreen({ code }: { code: string }) {
  const nickname = useSyncExternalStore(subscribeToGuest, () => readGuest()?.nickname ?? null, () => null);
  const [phase, setPhase] = useState<GamePhase>("demo");
  const [zone, setZone] = useState("Навигация");
  const radar = useRef<HTMLCanvasElement>(null);
  const paused = phase === "paused";
  const togglePause = useCallback(() => setPhase(current => current === "paused" ? "demo" : "paused"), []);
  const input = useGameInput(paused, togglePause);

  return <main className={styles.screen}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}><Icon name="station" width="28" height="28" /></span>
          <div><p className={styles.eyebrow}>Crew Mission</p><h1>Орбитальная станция</h1></div>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.room} title={code}>Код <strong>{code}</strong></span>
          <button type="button" className={styles.pause} onClick={togglePause} aria-pressed={paused}>
            <Icon name={paused ? "play" : "pause"} />{paused ? "Продолжить" : "Пауза"}
          </button>
          <Link href="/" className={styles.exit}><Icon name="exit" />В меню</Link>
        </div>
      </header>
      {!nickname && <p className={styles.connection}>Демо без подключения к комнате</p>}
      <div className={styles.layout}>
        <section className={styles.play} aria-label="Локальная демонстрация">
          <div className={styles.playHeader}>
            <span className={styles.zone} aria-live="polite"><Icon name="pin" />{zone}</span>
            <span className={styles.demo}><span />ДЕМО-РЕЖИМ</span>
          </div>
          <div className={styles.viewport}>
            <GameCanvas input={input} radar={radar} phase={phase} onZoneChange={setZone} />
            {paused && <div className={styles.pauseLayer}>
              <div className={styles.pauseCard}>
                <h2>Пауза</h2>
                <button className={styles.exit} type="button" onClick={togglePause}><Icon name="play" /> Продолжить</button>
              </div>
            </div>}
          </div>
          <GameControls input={input} paused={paused} />
        </section>
        <GameHud nickname={nickname ?? "Гость"} radar={radar} />
      </div>
    </div>
  </main>;
}
