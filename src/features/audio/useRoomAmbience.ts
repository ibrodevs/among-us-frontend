"use client";
import { useEffect } from "react";
import { useAudio } from "./AudioProvider";
import station from "../game/engine/asterion.json";
export function useRoomAmbience(
  x: number | undefined,
  y: number | undefined,
  active: boolean,
) {
  const { engine } = useAudio();
  const profile =
    active && x !== undefined && y !== undefined
      ? station.rooms.find((r) =>
          r.floor_parts.some(
            (p) =>
              x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height,
          ),
        )?.visual.audioProfile || ""
      : "";
  useEffect(() => {
    engine?.setZone(profile);
    return () => engine?.setZone("");
  }, [engine, profile]);
}
