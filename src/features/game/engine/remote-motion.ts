import type { Vector2 } from "./types";

type Sample = Vector2 & { at: number };

export class RemoteMotion {
  private samples: Sample[] = [];

  record(position: Vector2, at: number) {
    const last = this.samples.at(-1);
    if (last && at <= last.at) return;
    if (last && Math.hypot(position.x - last.x, position.y - last.y) > 120) {
      this.samples = [];
    }
    this.samples.push({ x: position.x, y: position.y, at });
    if (this.samples.length > 4) this.samples.shift();
  }

  position(now: number, speed: number, blocked: (point: Vector2) => boolean): Vector2 {
    const last = this.samples.at(-1)!;
    const target = now - 110;
    const nextIndex = this.samples.findIndex((sample) => sample.at >= target);
    if (nextIndex === 0 || this.samples.length === 1) return this.samples[0];
    if (nextIndex > 0) {
      const next = this.samples[nextIndex], previous = this.samples[nextIndex - 1];
      const blend = (target - previous.at) / (next.at - previous.at);
      const point = {
        x: previous.x + (next.x - previous.x) * blend,
        y: previous.y + (next.y - previous.y) * blend,
      };
      return blocked(point) ? last : point;
    }
    const previous = this.samples.at(-2)!;
    const elapsed = last.at - previous.at;
    const dx = last.x - previous.x, dy = last.y - previous.y;
    const distance = Math.hypot(dx, dy);
    if (!distance || elapsed > 250) return last;
    const advance = Math.min(target - last.at, 45) *
      Math.min(distance / elapsed, speed / 1000) / distance;
    const point = { x: last.x + dx * advance, y: last.y + dy * advance };
    return blocked(point) ? last : point;
  }
}
