import type { PointerEvent, RefObject } from "react";
import type { Direction, InputState } from "../engine/input";
import { mapConfig } from "../engine/map-config";
import styles from "../game.module.css";
import { Icon } from "./Icon";

export function GameHud({ nickname, radar }: { nickname: string; radar: RefObject<HTMLCanvasElement | null> }) {
  return <aside className={styles.hud} aria-label="Информация об игре">
    <section className={styles.profile}>
      <span className={styles.profileIcon}><Icon name="person" width="22" height="22" /></span>
      <div className={styles.profileText}>
        <span className={styles.eyebrow}>Ваш персонаж</span>
        <strong title={nickname}>{nickname}</strong>
      </div>
      <span className={styles.role} aria-label="Роль: Демо">Демо</span>
    </section>
    <section className={styles.tasks}>
      <h2><Icon name="tasks" /> Будущие задания</h2>
      <ul>
        {mapConfig.taskPoints.map(task => <li key={task.id}>
          <button type="button" className={styles.task} disabled><Icon name="lock" width="15" height="15" />{task.title}</button>
        </li>)}
      </ul>
    </section>
    <section className={styles.radar}>
      <h2><Icon name="radar" /> Схема станции</h2>
      <canvas ref={radar} width="400" height="225" aria-hidden="true" />
      <ul className={styles.legend}>
        {mapConfig.zones.map(zone => <li key={zone.id}>
          <span className={styles.swatch} style={{ backgroundColor: zone.color }} />{zone.name}
        </li>)}
      </ul>
    </section>
  </aside>;
}

const directions: { direction: Direction; label: string }[] = [
  { direction: "up", label: "Вверх" },
  { direction: "left", label: "Влево" },
  { direction: "down", label: "Вниз" },
  { direction: "right", label: "Вправо" },
];

export function GameControls({ input, paused }: { input: RefObject<InputState>; paused: boolean }) {
  function release(event: PointerEvent<HTMLButtonElement>) {
    input.current.pointers.delete(event.pointerId);

  }

  return <div className={styles.controls}>
    <div className={styles.keyboard}>
      <Icon name="keyboard" width="23" height="23" />
      <span>Движение</span>
      <span className={styles.keyset}><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>
      <span className={styles.or}>или</span>
      <span className={styles.keyset} aria-label="Стрелки"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span>
    </div>
    <div className={styles.touch}>
      <div className={styles.touchLabel}><Icon name="keyboard" /><strong>Движение</strong></div>
      <div className={styles.dpad} role="group" aria-label="Сенсорное управление">
        {directions.map(({ direction, label }) =>
          <button key={direction} type="button" aria-label={label} disabled={paused} data-direction={direction}
            onPointerDown={event => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);

              input.current.pointers.set(event.pointerId, direction);
            }}
            onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
            <Icon name={direction} />
          </button>)}
      </div>
    </div>
    <div className={styles.escape}><kbd>Esc</kbd> Пауза</div>
  </div>;
}
