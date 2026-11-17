/** Original procedural score and effects. No external recordings or copyrighted samples. */
import { soundNames, type SoundName } from "./SoundRegistry";
export { soundNames, type SoundName } from "./SoundRegistry";
export type AudioPreferences = {
  master: number;
  effects: number;
  music: number;
  muted: boolean;
};
const defaults: AudioPreferences = {
  master: 0.65,
  effects: 0.7,
  music: 0.15,
  muted: false,
};
export function readAudioPreferences(raw: string | null): AudioPreferences {
  const result = { ...defaults };
  try {
    const p = JSON.parse(raw || "{}");
    if (!p || typeof p !== "object") return result;
    for (const key of ["master", "effects", "music"] as const)
      if (typeof p[key] === "number" && Number.isFinite(p[key]))
        result[key] = Math.max(0, Math.min(1, p[key]));
    if (typeof p.muted === "boolean") result.muted = p.muted;
  } catch {}
  return result;
}
export type MusicMood =
  | "menu"
  | "lobby"
  | "exploration"
  | "critical"
  | "meeting"
  | "victory"
  | "defeat";
export class AudioManager {
  private zoneProfile = "";
  private zone: {
    osc: OscillatorNode;
    gain: GainNode;
    noise: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    noiseGain: GainNode;
  } | null = null;
  setZone(profile: string) {
    this.zoneProfile = profile;
    const c = this.context;
    if (!c || !this.master) return;
    if (!this.zone) {
      const osc = c.createOscillator(),
        gain = c.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      const noise = c.createBufferSource(),
        filter = c.createBiquadFilter(),
        noiseGain = c.createGain();
      const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
        samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] = (Math.random() * 2 - 1) * 0.3;
      noise.buffer = buffer;
      noise.loop = true;
      filter.type = "bandpass";
      filter.Q.value = 0.7;
      noiseGain.gain.value = 0;
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.master);
      noise.start();
      this.zone = { osc, gain, noise, filter, noiseGain };
    }
    const profiles = [
      "core",
      "electric",
      "turbine",
      "water",
      "workshop",
      "command",
      "compute",
      "radio",
      "surveillance",
      "space",
      "medical",
      "laboratory",
      "garden",
      "compressor",
      "home",
      "cargo",
      "ventilation",
      "servers",
      "transit",
      "pressure",
      "nexus",
    ];
    const index = profiles.indexOf(profile),
      at = c.currentTime;
    this.zone.osc.type = ["core", "turbine", "compressor", "pressure"].includes(
      profile,
    )
      ? "triangle"
      : "sine";
    this.zone.filter.frequency.setTargetAtTime(
      ["radio", "surveillance"].includes(profile)
        ? 1400
        : ["water", "garden", "servers", "ventilation"].includes(profile)
          ? 540
          : 180,
      at,
      0.8,
    );
    this.zone.noiseGain.gain.setTargetAtTime(
      index < 0
        ? 0
        : this.preferences.music *
            (["radio", "water", "garden", "servers", "ventilation"].includes(
              profile,
            )
              ? 0.12
              : 0.025),
      at,
      0.9,
    );
    this.zone.osc.frequency.setTargetAtTime(
      38 + Math.max(0, index) * 4.3,
      at,
      0.8,
    );
    this.zone.gain.gain.setTargetAtTime(
      index < 0 ? 0 : this.preferences.music * 0.035,
      at,
      0.7,
    );
  }
  private mood: MusicMood = "menu";
  setMood(mood: MusicMood) {
    this.mood = mood;
  }
  context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active = new Set<OscillatorNode>();
  private effects = new Map<OscillatorNode, GainNode>();
  cancelEffects() {
    const c = this.context;
    if (!c) return;
    for (const [osc, gain] of this.effects) {
      gain.gain.cancelScheduledValues(c.currentTime);
      gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.01);
      osc.stop(c.currentTime + 0.05);
    }
    this.effects.clear();
  }
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private beat = 0;
  preferences = { ...defaults };
  constructor() {
    try {
      this.preferences = readAudioPreferences(
        localStorage.getItem("crew.audio.v2"),
      );
    } catch {}
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.apply();
      this.setZone(this.zoneProfile);
      this.musicTimer = setInterval(() => this.ambient(), 4000);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }
  set(patch: Partial<AudioPreferences>) {
    this.preferences = { ...this.preferences, ...patch };
    try {
      localStorage.setItem("crew.audio.v2", JSON.stringify(this.preferences));
    } catch {}
    this.apply();
  }
  private apply() {
    if (this.zone) this.setZone(this.zoneProfile);
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        this.preferences.muted ? 0 : this.preferences.master,
        this.context.currentTime,
        0.03,
      );
  }
  private tone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    pan = 0,
  ) {
    const c = this.context;
    if (
      !c ||
      !this.master ||
      c.state !== "running" ||
      this.active.size >= 16 ||
      volume <= 0
    )
      return;
    const osc = c.createOscillator(),
      gain = c.createGain(),
      panner = c.createStereoPanner();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      start + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    panner.pan.value = Math.min(1, Math.max(-1, pan));
    osc.connect(gain).connect(panner).connect(this.master);
    this.active.add(osc);
    if (duration < 1) this.effects.set(osc, gain);
    osc.onended = () => {
      this.active.delete(osc);
      this.effects.delete(osc);
      osc.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
  play(
    name: SoundName,
    source?: { x: number; y: number },
    listener?: { x: number; y: number },
  ) {
    const c = this.context;
    if (!c || c.state !== "running" || this.preferences.muted) return;
    let attenuation = 1,
      pan = 0;
    if (source && listener) {
      const distance = Math.hypot(source.x - listener.x, source.y - listener.y);
      if (distance > 850) return;
      attenuation = Math.max(0, 1 - distance / 850);
      pan = (source.x - listener.x) / 650;
    }
    const index = soundNames.indexOf(name),
      base = 130 + index * 19,
      t = c.currentTime,
      level = 0.09 * this.preferences.effects * attenuation;
    const warning = name.startsWith("sabotage");
    this.tone(
      base,
      t,
      warning ? 0.45 : 0.12,
      level,
      index % 3 === 0 ? "triangle" : "sine",
      pan,
    );
    this.tone(
      base * (warning ? 0.75 : 1.5),
      t + 0.09,
      warning ? 0.5 : 0.16,
      level * 0.6,
      "sine",
      pan,
    );
    if (name === "task.success" || name === "game.win")
      this.tone(base * 2, t + 0.19, 0.3, level, "sine", pan);
  }
  private ambient() {
    const c = this.context;
    if (
      !c ||
      document.hidden ||
      c.state !== "running" ||
      this.preferences.muted
    )
      return;
    const roots: Record<MusicMood, number[]> = {
      menu: [130.81, 164.81, 146.83, 110],
      lobby: [146.83, 110, 130.81, 164.81],
      exploration: [110, 130.81, 98, 146.83],
      critical: [82.41, 87.31, 82.41, 116.54],
      meeting: [123.47, 146.83, 110, 98],
      victory: [164.81, 196, 220, 261.63],
      defeat: [73.42, 82.41, 65.41, 73.42],
    };
    const root = roots[this.mood][this.beat++ % 4];
    for (const ratio of [1, 1.5, 2])
      this.tone(
        root * ratio,
        c.currentTime,
        3.8,
        0.035 * this.preferences.music,
        "sine",
      );
  }
  suspend() {
    void this.context?.suspend();
  }
  close() {
    if (this.zone) {
      this.zone.osc.stop();
      this.zone.osc.disconnect();
      this.zone.gain.disconnect();
      this.zone.noise.stop();
      this.zone.noise.disconnect();
      this.zone.filter.disconnect();
      this.zone.noiseGain.disconnect();
      this.zone = null;
    }
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    for (const n of this.active) {
      n.onended = null;
      try {
        n.stop();
      } catch {}
      n.disconnect();
    }
    this.active.clear();
    this.effects.clear();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
  get nodeCount() {
    return this.active.size;
  }
}

export { AudioManager as StationAudio };
