import type { Rect, Vector2 } from "./types";

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

  reset() {
    this.position = null;
    this.server = null;
    this.gameId = "";
    this.version = -1;
  }

  sync(position: Vector2, version: number, gameId: string) {
    if (!this.position || gameId !== this.gameId) {
      this.gameId = gameId;
      this.position = { ...position };
      this.server = { ...position };
      this.version = version;
      return;
    }
    if (version <= this.version) return;
    this.version = version;
    this.server = { ...position };
    const distance = Math.hypot(
      position.x - this.position.x,
      position.y - this.position.y,
    );
    // A teleport, meeting reset or severe desync must be authoritative.
    if (distance > 110) {
      this.position = { ...position };
      return;
    }
    // Reconcile small errors without snapping each 100ms server tick.
    this.position = {
      x: this.position.x + (position.x - this.position.x) * 0.22,
      y: this.position.y + (position.y - this.position.y) * 0.22,
    };
  }

  advance(
    direction: Vector2,
    dt: number,
    map: { width: number; height: number; walls: readonly Rect[]; player_hitbox?: number },
    doors: readonly Rect[],
    speed: number,
    ghost = false,
  ): Vector2 | null {
    if (!this.position || !this.server) return null;
    const seconds = Math.max(0, Math.min(0.05, dt));
    const length = Math.hypot(direction.x, direction.y);
    if (!seconds || !length) {
      // Settle remaining prediction error after releasing controls.
      const factor = Math.min(1, seconds * 12);
      this.position = {
        x: this.position.x + (this.server.x - this.position.x) * factor,
        y: this.position.y + (this.server.y - this.position.y) * factor,
      };
      return this.position;
    }

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
    // Match the server's 20ms collision substeps to avoid crossing thin walls.
    const steps = Math.max(1, Math.ceil(seconds / 0.02));
    const stride = speed * seconds / steps / Math.max(1, length);
    let { x, y } = this.position;
    for (let i = 0; i < steps; i++) {
      const nextX = x + direction.x * stride;
      if (!blocked(nextX, y)) x = nextX;
      const nextY = y + direction.y * stride;
      if (!blocked(x, nextY)) y = nextY;
    }

    // Never let prediction run indefinitely ahead of the last server state.
    const dx = x - this.server.x;
    const dy = y - this.server.y;
    const lead = Math.hypot(dx, dy);
    const maxLead = Math.max(35, speed * 0.24);
    if (lead > maxLead) {
      x = this.server.x + dx * maxLead / lead;
      y = this.server.y + dy * maxLead / lead;
    }
    this.position = { x, y };
    return this.position;
  }
}
