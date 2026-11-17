"use client";
import { useEffect, useState } from "react";
import { gameApi } from "@/lib/api";
import { palette } from "../engine/asterion-renderer";
export function ColorPicker({
  code,
  token,
  playerId,
}: {
  code: string;
  token: string;
  playerId: string;
}) {
  const [players, setPlayers] = useState<
      { player_id: string; color: number | null }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () =>
      gameApi
        .getAppearance(token, code)
        .then((data) => {
          if (active) setPlayers(data.players);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void refresh();
    const id = setInterval(refresh, 2500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [code, token]);
  const own = players.find((p) => p.player_id === playerId)?.color;
  return (
    <fieldset>
      <legend>Цвет робота на Asterion</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {palette.map((color, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Цвет ${i + 1}`}
            aria-pressed={own === i}
            disabled={players.some(
              (p) => p.player_id !== playerId && p.color === i,
            )}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              border: own === i ? "4px solid #042c60" : "2px solid #a7c5d2",
              background: color,
              color: "#042c60",
              fontWeight: 800,
            }}
            onClick={() => {
              gameApi
                .setAppearance(token, code, i)
                .then((data) => {
                  setPlayers(data.players);
                  setError("");
                })
                .catch((e) => setError(e.message));
            }}
          >
            {own === i ? "✓" : i + 1}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
