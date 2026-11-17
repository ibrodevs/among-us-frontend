"use client";
import { useAudio } from "./AudioProvider";
export function AudioSettings() {
  const { preferences: prefs, ready, update } = useAudio();
  return (
    <details>
      <summary>
        Звук ·{" "}
        {prefs.muted ? "выключен" : ready ? "включён" : "нажмите для включения"}
      </summary>
      <button
        className="action secondary"
        onClick={() => update({ muted: !prefs.muted })}
      >
        {prefs.muted ? "Включить звук" : "Выключить звук"}
      </button>
      {(["master", "effects", "music"] as const).map((key, i) => (
        <label key={key}>
          {["Общая громкость", "Эффекты", "Музыка"][i]}
          <input
            aria-label={["Общая громкость", "Эффекты", "Музыка"][i]}
            type="range"
            min="0"
            max="1"
            step=".05"
            value={prefs[key]}
            onChange={(e) => update({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
    </details>
  );
}
