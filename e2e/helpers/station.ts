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
  const ghost = c.own?.alive === false;
  const size = 20,
    w = Math.ceil(station.width / size),
    h = Math.ceil(station.height / size),
    walls = ghost ? [] : [
      ...station.walls,
      ...(c.snapshot?.doors || []).filter((d) => d.closed).map((d) => d.bounds),
    ],
    clear = (x: number, y: number, half = 20) =>
      x >= half && y >= half && x <= station.width - half &&
      y <= station.height - half && !walls.some(
        (r) =>
          x - half < r.x + r.width &&
          x + half > r.x &&
          y - half < r.y + r.height &&
          y + half > r.y,
      ),
    ds = new Int32Array(w * h),
    queue = new Int32Array(w * h);
  ds.fill(-1);
  let head = 0,
    tail = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (
        Math.hypot(x * size + 10 - target.x, y * size + 10 - target.y) < 55 &&
        clear(x * size + 10, y * size + 10)
      ) {
        ds[y * w + x] = 0;
        queue[tail++] = y * w + x;
      }
  while (head < tail) {
    const n = queue[head++];
    for (const q of neighbors(n))
      if (
        q >= 0 &&
        q < w * h &&
        ds[q] < 0 &&
        clear((q % w) * size + 10, Math.floor(q / w) * size + 10)
      ) {
        ds[q] = ds[n] + 1;
        queue[tail++] = q;
      }
  }
  function neighbors(n: number) {
    const x = n % w;
    return [n - w, n + w, x > 0 ? n - 1 : -1, x < w - 1 ? n + 1 : -1];
  }
  const began = Date.now();
  while (Math.hypot(c.own!.x! - target.x, c.own!.y! - target.y) >= 75) {
    if (Date.now() - began > 120000)
      throw new Error(
        `Walking timeout ${c.snapshot?.phase}: ${c.own!.x},${c.own!.y} toward ${target.x},${target.y}`,
      );
    const pos = { x: c.own!.x!, y: c.own!.y! };
    const safe = (axis: "x" | "y", delta: number) => {
      for (let i = 0; i <= Math.abs(delta); i += 3)
        if (
          !clear(
            pos.x + (axis === "x" ? Math.sign(delta) * i : 0),
            pos.y + (axis === "y" ? Math.sign(delta) * i : 0),
            14,
          )
        )
          return false;
      return true;
    };
    let n = Math.floor(pos.y / size) * w + Math.floor(pos.x / size),
      recovery = false;
    if (ds[n] < 0) {
      let distance = Infinity;
      const cx = Math.floor(pos.x / size),
        cy = Math.floor(pos.y / size);
      for (let y = cy - 4; y <= cy + 4; y++)
        for (let x = cx - 4; x <= cx + 4; x++) {
          if (x < 0 || x >= w || y < 0 || y >= h) continue;
          const q = y * w + x,
            dx = x * size + 10 - pos.x,
            dy = y * size + 10 - pos.y,
            d = Math.hypot(dx, dy);
          if (
            ds[q] >= 0 &&
            d < distance &&
            ((Math.abs(dx) < 3 && safe("y", dy)) ||
              (Math.abs(dy) < 3 && safe("x", dx)) ||
              (safe("x", dx) && safe("y", dy)))
          ) {
            n = q;
            distance = d;
            recovery = true;
          }
        }
      if (!recovery) throw new Error("No reachable movement recovery cell");
    }
    let best = n,
      delta = 0;
    for (let i = 0; !recovery && i < 4; i++) {
      const q = neighbors(best).find(
        (q) => ds[q] >= 0 && ds[q] < ds[best],
      );
      if (q === undefined || (i && q - best !== delta)) break;
      delta = q - best;
      best = q;
    }
    const dx = (best % w) * size + 10 - pos.x,
      dy = Math.floor(best / w) * size + 10 - pos.y;
    const axes: ["x" | "y", number][] =
      Math.abs(dx) > Math.abs(dy)
        ? [
            ["x", dx],
            ["y", dy],
          ]
        : [
            ["y", dy],
            ["x", dx],
          ];
    const axis = axes.find(([key, d]) => Math.abs(d) > 3 && safe(key, d));
    if (!axis) throw new Error(`No safe movement at ${pos.x},${pos.y}`);
    const key =
        axis[0] === "x"
          ? axis[1] > 0
            ? "ArrowRight"
            : "ArrowLeft"
          : axis[1] > 0
            ? "ArrowDown"
            : "ArrowUp",
      seq = c.own!.last_move_seq;
    await c.page.keyboard.down(key);
    await sleep(
      Math.max(40, Math.min(350, ((Math.abs(axis[1]) - 3) / 220) * 1000)),
    );
    await c.page.keyboard.up(key);
    await expect.poll(() => c.own!.last_move_seq).toBeGreaterThan(seq);
    await sleep(120);
  }
}
