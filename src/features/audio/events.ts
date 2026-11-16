import type { SoundName } from "./SoundRegistry";
export function sound(name: SoundName) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("crew.sound", { detail: name }));
}
