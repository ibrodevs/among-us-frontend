"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { AudioManager, type AudioPreferences } from "./AudioManager";
import { soundNames, type SoundName } from "./SoundRegistry";
import { AudioSettings } from "./AudioSettings";
type AudioContextValue = {
  engine: AudioManager | null;
  preferences: AudioPreferences;
  ready: boolean;
  update: (patch: Partial<AudioPreferences>) => void;
};
const Context = createContext<AudioContextValue | null>(null);
export function useAudio() {
  const value = useContext(Context);
  if (!value) throw new Error("AudioProvider missing");
  return value;
}
export function AudioProvider({ children }: { children: ReactNode }) {
  const [engine, setEngine] = useState<AudioManager | null>(null),
    [ready, setReady] = useState(false),
    [preferences, setPreferences] = useState<AudioPreferences>({
      master: 0.65,
      effects: 0.7,
      music: 0.15,
      muted: false,
    });
  const pathname = usePathname(),
    previousPath = useRef(pathname);
  useEffect(() => {
    const audio = new AudioManager();
    setEngine(audio);
    setPreferences({ ...audio.preferences });
    const unlock = () => {
      void audio
        .unlock()
        .then(() => setReady(true))
        .catch(() => setReady(false));
    };
    const click = (e: Event) => {
      const target =
        e.target instanceof Element ? e.target.closest("button,a") : null;
      if (!target) return;
      unlock();
      audio.play("ui.click");
      const text = target.textContent || "";
      if (text.includes("Саботаж") || text.includes("Карта"))
        audio.play("ui.open");
      if (text.includes("Закрыть")) audio.play("ui.close");
    };
    let hoverAt = 0;
    const hover = (e: Event) => {
      if (
        e.target instanceof Element &&
        e.target.closest("button,a") &&
        performance.now() - hoverAt > 150
      ) {
        audio.play("menu.hover");
        hoverAt = performance.now();
      }
    };
    const event = (e: Event) => {
      const name = (e as CustomEvent<SoundName>).detail;
      if (soundNames.includes(name)) audio.play(name);
    };
    const hide = () => {
      if (document.hidden) audio.suspend();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("click", click);
    window.addEventListener("pointerover", hover);
    window.addEventListener("crew.sound", event);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("click", click);
      window.removeEventListener("pointerover", hover);
      window.removeEventListener("crew.sound", event);
      document.removeEventListener("visibilitychange", hide);
      audio.close();
    };
  }, []);
  useEffect(() => {
    if (!engine) return;
    if (pathname.startsWith("/room/")) {
      engine.setMood("lobby");
      if (previousPath.current !== pathname) engine.play("room.create");
    } else if (!pathname.startsWith("/game/")) {
      engine.setMood(pathname.startsWith("/demo") ? "exploration" : "menu");
      if (previousPath.current !== pathname) engine.play("menu.return");
    }
    previousPath.current = pathname;
  }, [pathname, engine]);
  const update = useCallback(
    (patch: Partial<AudioPreferences>) => {
      engine?.set(patch);
      setPreferences((p) => ({ ...p, ...patch }));
    },
    [engine],
  );
  return (
    <Context.Provider value={{ engine, preferences, ready, update }}>
      {children}
      <div
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 60,
          background: "#fff",
          padding: "8px 12px",
          border: "2px solid #d7ffb8",
          borderRadius: 14,
          maxWidth: 280,
          boxShadow: "0 3px 15px #042c6012",
        }}
      >
        <AudioSettings />
      </div>
    </Context.Provider>
  );
}
