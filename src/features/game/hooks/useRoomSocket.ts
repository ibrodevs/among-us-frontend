"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@/lib/types";
import { WS_BASE } from "@/lib/config";
import { readGuest } from "@/lib/guest";
import { acceptSnapshot } from "../network/types";
import type {
  Command,
  ConnectionStatus,
  OwnState,
  Snapshot,
} from "../network/types";

export function useRoomSocket(code: string) {
  const socket = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [room, setRoom] = useState<Room | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [own, setOwn] = useState<OwnState | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState("");
  const [ping, setPing] = useState<number | null>(null);
  const serverOffset = useRef(0);
  useEffect(() => {
    const guest = readGuest();
    if (!guest) {
      setStatus("unauthorized");
      return;
    }
    let disposed = false,
      attempts = 0,
      retry: ReturnType<typeof setTimeout> | undefined,
      heartbeat: ReturnType<typeof setInterval> | undefined,
      pingAt = 0,
      lastMessage = Date.now();
    function connect() {
      if (disposed) return;
      setStatus(attempts ? "reconnecting" : "connecting");
      const ws = new WebSocket(
        WS_BASE + "/ws/rooms/" + encodeURIComponent(code) + "/",
      );
      socket.current = ws;
      ws.onopen = () =>
        ws.send(
          JSON.stringify({
            type: "auth",
            token: guest!.token,
            protocol_version: 2,
          }),
        );
      ws.onmessage = (event) => {
        if (disposed) return;
        lastMessage = Date.now();
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          setError("Сервер прислал некорректное сообщение");
          return;
        }
        if (message.type === "auth.ok") {
          setPlayerId(message.player_id);
          setStatus("connected");
          setError("");
          attempts = 0;
          heartbeat = setInterval(() => {
            if (Date.now() - lastMessage > 45000) {
              ws.close();
              return;
            }
            if (ws.readyState === WebSocket.OPEN) {
              pingAt = Date.now();
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 15000);
        } else if (message.type === "room.snapshot") {
          setRoom(message.room);
        } else if (
          message.type === "game.snapshot" &&
          [1, 2].includes(message.protocol_version)
        ) {
          serverOffset.current = Date.parse(message.server_time) - Date.now();
          setSnapshot((previous) => acceptSnapshot(previous, message));
        } else if (
          message.type === "game.self" &&
          [1, 2].includes(message.protocol_version)
        ) {
          setOwn((previous) =>
            !previous ||
            message.game_id !== previous.game_id ||
            message.state_version >= previous.state_version
              ? message
              : previous,
          );
        } else if (message.type === "pong") {
          setPing(Date.now() - pingAt);
        } else if (message.type === "error") {
          if (!["STALE_SEQ", "RATE_LIMITED"].includes(message.code))
            setError(message.detail);
        }
      };
      ws.onerror = () => setError("Не удалось связаться со станцией");
      ws.onclose = (event) => {
        clearInterval(heartbeat);
        if (disposed) return;
        if (event.code === 4401) {
          setStatus("unauthorized");
          return;
        }
        setStatus("reconnecting");
        attempts++;
        retry = setTimeout(
          connect,
          Math.min(10000, 500 * 2 ** Math.min(attempts, 5)) +
            Math.random() * 250,
        );
      };
    }
    const offline = () => socket.current?.close();
    const online = () => {
      clearTimeout(retry);
      if (socket.current?.readyState === WebSocket.CLOSED) connect();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    connect();
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      disposed = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      socket.current?.close();
      socket.current = null;
    };
  }, [code]);
  const send = useCallback((command: Command) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(command));
      setError("");
      return true;
    }
    return false;
  }, []);
  return {
    room,
    status,
    snapshot,
    own,
    playerId,
    error,
    ping,
    send,
    serverOffset,
  };
}
