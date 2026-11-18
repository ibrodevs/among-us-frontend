import type { Rect, Vector2 } from "./types";

type InputFrame = { sequence: number; direction: Vector2; seconds: number };

/**
 * Cosmetic, collision-aware prediction for the local player only.
 * The Django simulation remains authoritative for positions, actions,
 * visibility, kills, tasks and interactions.
 */
export class LocalMotionPredictor {
  private position: Vector2 | null = null;
  private server: Vector2 | null = null;
  private gameId = "";
  private version = -1;
  private correcting = false;
  private acknowledged?: number;
  private input: InputFrame[] = [];

  reset() {
    this.position = null;
    this.server = null;
    this.gameId = "";
    this.version = -1;
    this.correcting = false;
    this.acknowledged = undefined;
    this.input = [];
  }

  sync(position: Vector2, version: number, gameId: string, acknowledged?: number) {
    if (!this.position || gameId !== this.gameId) {
      this.reset();
      this.gameId = gameId;
      this.position = { ...position };
      this.server = { ...position };
      this.version = version;
      this.acknowledged = acknowledged;
      return;
    }
    const sameConfirmation = version === this.version &&
      (acknowledged === undefined || acknowledged === this.acknowledged);
    if (version < this.version || sameConfirmation) return;
    this.version = version;
    if (acknowledged !== undefined) {
      this.acknowledged = acknowledged;
      this.input = this.input.filter((frame) => frame.sequence > acknowledged);
    }
    this.server = { ...position };
    const distance = Math.hypot(
      position.x - this.position.x,
      position.y - this.position.y,
    );
    // A teleport, meeting reset or severe desync must be authoritative.
    if (distance > 110) {
      this.position = { ...position };
      this.correcting = false;
      this.input = [];
      return;
    }
    this.correcting = true;
  }

  advance(
    direction: Vector2,
    dt: number,
    map: { width: number; height: number; walls: readonly Rect[]; player_hitbox?: number },
    doors: readonly Rect[],
    speed: number,
    ghost = false,
    sequence?: number,
  ): Vector2 | null {
    if (!this.position || !this.server) return null;
    const seconds = Math.max(0, Math.min(0.05, dt));
    const length = Math.hypot(direction.x, direction.y);
    if (!length) this.input = [];
    const hitbox = (map.player_hitbox ?? 28) / 2;
    const blocked = (x: number, y: number) => {
      if (x - hitbox < 0 || y - hitbox < 0 ||
          x + hitbox > map.width || y + hitbox > map.height) return true;
      if (ghost) return false;
      const overlaps = (r: Rect) =>
        x - hitbox < r.x + r.width &&
        x + hitbox > r.x &&
        y - hitbox < r.y + r.height &&
        y + hitbox > r.y;
      return map.walls.some(overlaps) || doors.some(overlaps);
    };
    let { x, y } = this.position;
    const server = this.server;
    const maxLead = speed * 0.24;
    const canMove = (nx: number, ny: number) =>
      Math.hypot(nx - server.x, ny - server.y) <= maxLead && !blocked(nx, ny);
    // Mirror the server's axis sliding and 20 ms collision substeps.
    const travel = (origin: Vector2, intent: Vector2, duration: number) => {
      let { x, y } = origin;
      const steps = Math.ceil(duration / 0.02);
      const stride = speed * duration / steps / Math.max(1, Math.hypot(intent.x, intent.y));
      for (let i = 0; i < steps; i++) {
        const nextX = x + intent.x * stride;
        if (intent.x && canMove(nextX, y)) x = nextX;
        const nextY = y + intent.y * stride;
        if (intent.y && canMove(x, nextY)) y = nextY;
      }
      return { x, y };
    };
    if (blocked(x, y) || Math.hypot(x - server.x, y - server.y) > maxLead) {
      ({ x, y } = server);
    }

    if (this.correcting || !length) {
      let target = server;
      if (this.correcting && length && this.acknowledged !== undefined) {
        let remaining = 0.24;
        for (const frame of this.input) {
          const duration = Math.min(remaining, frame.seconds);
          target = travel(target, frame.direction, duration);
          remaining -= duration;
          if (remaining <= 0) break;
        }
      }
      const fraction = length ? 0.22 : Math.min(1, seconds * 12);
      const nextX = x + (target.x - x) * fraction;
      const nextY = y + (target.y - y) * fraction;
      // Reconciliation can cut a corner when client and server slide along
      // different axes. Sample the correction path before moving the sprite.
      const steps = Math.max(1, Math.ceil(Math.hypot(nextX - x, nextY - y) / 3));
      for (let i = 1; i <= steps; i++) {
        if (blocked(x + (nextX - x) * i / steps, y + (nextY - y) * i / steps)) {
          this.position = { ...server };
          this.correcting = false;
          return this.position;
        }
      }
      x = nextX;
      y = nextY;
      this.correcting = false;
    }

    if (seconds && length) {
      ({ x, y } = travel({ x, y }, direction, seconds));
      if (sequence !== undefined && sequence > (this.acknowledged ?? -1)) {
        this.input.push({ sequence, direction, seconds });
        if (this.input.length > 40) this.input.shift();
      }
    }
    this.position = { x, y };
    return this.position;
  }
}
