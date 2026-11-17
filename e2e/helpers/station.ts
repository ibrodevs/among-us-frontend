import { expect, type Page, type BrowserContext } from "@playwright/test";
import type { Snapshot, OwnState } from "../../src/features/game/network/types";
import station from "../../src/features/game/engine/asterion.json";
export type Client = {
  page: Page;
  context: BrowserContext;
  own: OwnState | null;
  snapshot: Snapshot | null;
  id: string;
  errors: string[];
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function walk(c: Client, target: { x: number; y: number }) {
  const size = 20,
    w = Math.ceil(station.width / size),
    h = Math.ceil(station.height / size),
    walls = [
      ...station.walls,
      ...(c.snapshot?.doors || []).filter((d) => d.closed).map((d) => d.bounds),
    ],
    free = (x: number, y: number) =>
      !walls.some(
        (r) =>
          x - 24 < r.x + r.width &&
          x + 24 > r.x &&
          y - 24 < r.y + r.height &&
          y + 24 > r.y,
      );
  const key = (x: number, y: number) => y * w + x,
    startX = Math.floor(c.own!.x! / size),
    startY = Math.floor(c.own!.y! / size),
    start = key(startX, startY),
    queue = [start],
    parents = new Map<number, number>([[start, -1]]);
  let goal = -1;
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i],
      x = n % w,
      y = Math.floor(n / w);
    if (Math.hypot(x * size + 10 - target.x, y * size + 10 - target.y) < 55) {
      goal = n;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = key(nx, ny);
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= w ||
        ny >= h ||
        parents.has(k) ||
        !free(nx * size + 10, ny * size + 10)
      )
        continue;
      parents.set(k, n);
      queue.push(k);
    }
  }
  if (goal < 0) throw new Error("No reachable UI walking path");
  const path: number[] = [];
  for (let n = goal; n !== -1; n = parents.get(n)!) path.push(n);
  path.reverse();
  const points = path
    .filter(
      (n, i) =>
        i === path.length - 1 || (i > 0 && n - path[i - 1] !== path[i + 1] - n),
    )
    .map((n) => ({ x: (n % w) * size + 10, y: Math.floor(n / w) * size + 10 }));
  for (const p of points) {
    for (let attempt = 0; attempt < 35; attempt++) {
      const position = { x: c.own!.x!, y: c.own!.y! };
      const axes = (["x", "y"] as const).filter(
        (axis) => Math.abs(p[axis] - position[axis]) >= 8,
      );
      if (!axes.length) break;
      const canTravel = (axis: "x" | "y") => {
        const delta = p[axis] - position[axis];
        for (let n = 0; n <= Math.abs(delta); n += 6) {
          const q = {
            ...position,
            [axis]: position[axis] + Math.sign(delta) * n,
          };
          if (
            walls.some(
              (r) =>
                q.x - 14 < r.x + r.width &&
                q.x + 14 > r.x &&
                q.y - 14 < r.y + r.height &&
                q.y + 14 > r.y,
            )
          )
            return false;
        }
        return true;
      };
      const axis = axes.find(canTravel);
      if (!axis)
        throw new Error(
          `No safe corner alignment at ${position.x},${position.y} to ${p.x},${p.y}`,
        );
      const delta = p[axis] - position[axis],
        key =
          axis === "x"
            ? delta > 0
              ? "ArrowRight"
              : "ArrowLeft"
            : delta > 0
              ? "ArrowDown"
              : "ArrowUp";
      const ackBefore = c.own!.last_move_seq;
      await c.page.keyboard.down(key);
      await sleep(
        Math.max(40, Math.min(900, ((Math.abs(delta) - 3) / 220) * 1000)),
      );
      await c.page.keyboard.up(key);
      await expect
        .poll(() => c.own!.last_move_seq, { timeout: 15000 })
        .toBeGreaterThan(ackBefore);
      await sleep(150);
      if (attempt === 34)
        throw new Error(
          `Walking did not settle at ${c.own!.x},${c.own!.y} toward ${p.x},${p.y}`,
        );
    }
  }
  expect(Math.hypot(c.own!.x! - target.x, c.own!.y! - target.y)).toBeLessThan(
    85,
  );
}
