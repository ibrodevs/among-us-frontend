import station from "./asterion.json";
import type { Rect, Vector2 } from "./types";
import type { Snapshot } from "../network/types";
import { drawPlayer } from "./render-world";
export { station };
export const palette = [
  "#5de4c7",
  "#73abff",
  "#ffba6a",
  "#e58bdf",
  "#f3eb86",
  "#bd99ff",
  "#ff7d89",
  "#86d8f0",
  "#d8e7e4",
  "#b4ce76",
];
const sectorColors: Record<string, string> = {
  engineering: "#e6a86c",
  command: "#75a9ed",
  science: "#81d8a8",
  logistics: "#bb95e2",
  nexus: "#70d7d1",
};
const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
function box(ctx: CanvasRenderingContext2D, r: Rect, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.width, r.height);
}
function machine(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  kind: string,
  color: string,
) {
  ctx.save();
  ctx.translate(r.x, r.y);
  const w = r.width,
    h = r.height;
  if (["reactor", "engine", "fuel"].includes(kind)) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.32, h * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#173240";
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, kind === "reactor" ? 22 : 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d7e3e8";
    ctx.lineWidth = 3;
    for (let a = 0; a < 6; a++) {
      const t = (a * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(t) * 23, h / 2 + Math.sin(t) * 23);
      ctx.lineTo(w / 2 + Math.cos(t) * 35, h / 2 + Math.sin(t) * 30);
      ctx.stroke();
    }
  } else if (["capsule", "pod", "bed"].includes(kind)) {
    ctx.fillStyle = "#1c3947";
    ctx.beginPath();
    ctx.roundRect(12, 9, w - 24, h - 18, 24);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    box(
      ctx,
      { x: 22, y: 20, width: w - 44, height: h - 40 },
      kind === "bed" ? "#cbd5e6" : "#5eaaa0",
    );
    ctx.strokeStyle = "#b0efe0";
    ctx.beginPath();
    ctx.moveTo(25, 23);
    ctx.lineTo(w - 25, h - 23);
    ctx.stroke();
    box(ctx, { x: w - 27, y: h / 2 - 9, width: 9, height: 18 }, color);
  } else if (["pipes", "tram", "airlock"].includes(kind)) {
    for (let j = 0; j < 3; j++) {
      box(ctx, { x: 13, y: 14 + j * 23, width: w - 26, height: 12 }, "#8a9eaa");
      box(ctx, { x: 18, y: 16 + j * 23, width: w - 36, height: 4 }, color);
      ctx.strokeStyle = "#173344";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(40 + j * 25, 20 + j * 23, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (["crate", "servers"].includes(kind)) {
    for (let j = 0; j < 3; j++) {
      box(
        ctx,
        { x: 13 + j * 36, y: 13, width: 29, height: h - 26 },
        kind === "crate" ? "#8c7259" : "#31485b",
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(13 + j * 36, 13, 29, h - 26);
      for (let n = 0; n < 4; n++)
        box(
          ctx,
          { x: 18 + j * 36, y: 20 + n * 12, width: 18, height: 3 },
          color,
        );
    }
  } else if (["antenna", "telescope"].includes(kind)) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(20, h - 15);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(w - 20, 20);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 28, Math.PI * 0.2, Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 36, Math.PI * 0.2, Math.PI * 1.2);
    ctx.stroke();
  } else {
    for (let j = 0; j < 5; j++)
      box(
        ctx,
        { x: 20 + j * 18, y: 24, width: 8, height: 24 + (j % 3) * 6 },
        color,
      );
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 65);
    ctx.lineTo(40, 55);
    ctx.lineTo(60, 65);
    ctx.lineTo(85, 40);
    ctx.lineTo(112, 48);
    ctx.stroke();
  }
  ctx.restore();
}
export class StationRenderer {
  private chunks = new Map<string, HTMLCanvasElement>();
  private visionKey = "";
  private visionPoints: Vector2[] = [];
  private cameraPosition: Vector2 | null = null;
  private doorProgress = new Map<string, number>();
  private positions = new Map<string, Vector2>();
  clear() {
    this.chunks.clear();
    this.positions.clear();
    this.doorProgress.clear();
  }
  get cacheSize() {
    return this.chunks.size;
  }
  private chunk(cx: number, cy: number) {
    const key = `${cx},${cy}`;
    let surface = this.chunks.get(key);
    if (surface) {
      this.chunks.delete(key);
      this.chunks.set(key, surface);
      return surface;
    }
    surface = document.createElement("canvas");
    surface.width = surface.height = 512;
    const ctx = surface.getContext("2d")!;
    ctx.translate(-cx * 512, -cy * 512);
    const bounds = { x: cx * 512, y: cy * 512, width: 512, height: 512 };
    box(ctx, bounds, "#090f1c");
    for (const c of station.corridors)
      if (intersects(c.bounds, bounds)) {
        box(ctx, c.bounds, "#243343");
        ctx.strokeStyle = "#657889";
        ctx.lineWidth = 3;
        ctx.strokeRect(
          c.bounds.x + 6,
          c.bounds.y + 6,
          c.bounds.width - 12,
          c.bounds.height - 12,
        );
      }
    for (const room of station.rooms) {
      if (!intersects(room.bounds, bounds)) continue;
      const r = room.bounds,
        color = sectorColors[room.sector] || "#70d7d1";
      box(
        ctx,
        r,
        (
          {
            engineering: "#302d2a",
            command: "#1b2938",
            science: "#203630",
            logistics: "#302a3d",
            nexus: "#20353b",
          } as Record<string, string>
        )[room.sector],
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.strokeRect(r.x + 7, r.y + 7, r.width - 14, r.height - 14);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x + 12, r.y + 12, r.width - 24, r.height - 24);
      ctx.clip();
      ctx.strokeStyle = "#334553";
      ctx.lineWidth = 1;
      for (let x = r.x; x < r.x + r.width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, r.y);
        ctx.lineTo(x, r.y + r.height);
        ctx.stroke();
      }
      for (let y = r.y; y < r.y + r.height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(r.x, y);
        ctx.lineTo(r.x + r.width, y);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.font = "600 20px sans-serif";
      ctx.fillText(room.name.toUpperCase(), r.x + 35, r.y + 45);
      ctx.globalAlpha = 0.15;
      ctx.font = "bold 110px sans-serif";
      ctx.fillText(room.sector.slice(0, 2).toUpperCase(), r.x + 660, r.y + 450);
      ctx.restore();
      // Recessed space windows and wall light strips.
      for (let i = 0; i < 4; i++) {
        box(
          ctx,
          { x: r.x + 150 + i * 155, y: r.y + 15, width: 100, height: 24 },
          "#080f25",
        );
        box(
          ctx,
          { x: r.x + 160 + i * 155, y: r.y + 19, width: 80, height: 3 },
          color,
        );
      }
    }
    for (const d of station.decorations) {
      if (!intersects(d.bounds, bounds)) continue;
      const r = d.bounds,
        color =
          sectorColors[station.rooms.find((q) => q.id === d.room_id)!.sector] ||
          "#70d7d1";
      box(ctx, { ...r, y: r.y + 8 }, "#060e17");
      box(ctx, r, "#415466");
      ctx.strokeStyle = "#7890a1";
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x, r.y, r.width, r.height);
      box(
        ctx,
        {
          x: r.x + 12,
          y: r.y + 12,
          width: r.width - 24,
          height: r.height - 35,
        },
        "#0b1b2b",
      );
      machine(ctx, r, d.kind, color);
      for (let i = 0; i < 3; i++)
        box(
          ctx,
          {
            x: r.x + 15 + i * 32,
            y: r.y + r.height - 15,
            width: 20,
            height: 4,
          },
          color,
        );
    }
    this.chunks.set(key, surface);
    while (this.chunks.size > 24)
      this.chunks.delete(this.chunks.keys().next().value!);
    return surface;
  }
  draw(
    ctx: CanvasRenderingContext2D,
    data: Snapshot,
    playerId: string,
    width: number,
    height: number,
    time: number,
    dt: number,
  ) {
    const own = data.players.find((p) => p.id === playerId);
    if (!own) return;
    const camera = this.cameraPosition || { x: own.x, y: own.y };
    const blend = Math.min(1, dt * 14);
    this.cameraPosition = {
      x: camera.x + (own.x - camera.x) * blend,
      y: camera.y + (own.y - camera.y) * blend,
    };
    const scale = Math.max(0.65, Math.min(1.1, width / 1000));
    const view = {
      x: Math.max(
        0,
        Math.min(
          station.width - width / scale,
          this.cameraPosition.x - width / scale / 2,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          station.height - height / scale,
          this.cameraPosition.y - height / scale / 2,
        ),
      ),
      width: width / scale,
      height: height / scale,
    };
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-view.x, -view.y);
    for (
      let x = Math.floor(view.x / 512);
      x <= Math.floor((view.x + view.width) / 512);
      x++
    )
      for (
        let y = Math.floor(view.y / 512);
        y <= Math.floor((view.y + view.height) / 512);
        y++
      )
        ctx.drawImage(this.chunk(x, y), x * 512, y * 512);
    for (const door of data.doors || []) {
      if (!intersects(door.bounds, view)) continue;
      const r = door.bounds,
        old = this.doorProgress.get(door.id) ?? (door.closed ? 1 : 0),
        p = old + ((door.closed ? 1 : 0) - old) * Math.min(1, dt * 12);
      this.doorProgress.set(door.id, p);
      const color = door.closed ? "#bd5f62" : "#6fcfc5";
      if (r.height > r.width) {
        const size = 4 + (r.height / 2 - 4) * p;
        box(ctx, { ...r, height: size }, color);
        box(ctx, { ...r, y: r.y + r.height - size, height: size }, color);
      } else {
        const size = 4 + (r.width / 2 - 4) * p;
        box(ctx, { ...r, width: size }, color);
        box(ctx, { ...r, x: r.x + r.width - size, width: size }, color);
      }
    }
    for (const v of station.vents) {
      if (
        !intersects({ x: v.x - 30, y: v.y - 15, width: 60, height: 30 }, view)
      )
        continue;
      box(ctx, { x: v.x - 30, y: v.y - 15, width: 60, height: 30 }, "#0b141e");
      const event = data.effects?.find(
          (e) =>
            e.type.startsWith("vent.") && Math.hypot(e.x - v.x, e.y - v.y) < 85,
        ),
        age = event ? (time - Date.parse(event.at)) / 1000 : 2;
      ctx.save();
      if (age < 1.2) {
        ctx.translate(v.x, v.y - 15);
        ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(age * Math.PI))));
        ctx.translate(-v.x, -v.y + 15);
      }
      ctx.strokeStyle = age < 1.2 ? "#8be6cf" : "#7a929f";
      ctx.lineWidth = 3;
      for (let i = -20; i <= 20; i += 10) {
        ctx.beginPath();
        ctx.moveTo(v.x + i, v.y - 10);
        ctx.lineTo(v.x + i, v.y + 10);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const t of station.tasks) {
      if (
        !intersects({ x: t.x - 18, y: t.y - 18, width: 36, height: 36 }, view)
      )
        continue;
      box(ctx, { x: t.x - 18, y: t.y - 18, width: 36, height: 36 }, "#0b2030");
      box(
        ctx,
        { x: t.x - 13, y: t.y - 12, width: 26, height: 17 },
        Math.sin(time / 500 + t.x) > 0 ? "#88e5c7" : "#469d91",
      );
    }
    for (const t of station.terminals) {
      ctx.fillStyle = data.terminal_activity?.includes(t.id)
        ? Math.sin(time / 180) > 0
          ? "#b8f68a"
          : "#58cc02"
        : "#89c8ff";
      ctx.font = "bold 17px sans-serif";
      ctx.fillText(t.type.toUpperCase(), t.x - 40, t.y - 30);
    }
    ctx.fillStyle = "#efbd65";
    ctx.beginPath();
    ctx.arc(station.emergency.x, station.emergency.y, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#182331";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText("!", station.emergency.x - 5, station.emergency.y + 10);
    for (const b of data.bodies) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(-0.25);
      ctx.fillStyle = palette[(b.color || 0) % 10];
      ctx.strokeStyle = "#071525";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-27, -12, 48, 27, 7);
      ctx.fill();
      ctx.stroke();
      box(ctx, { x: -19, y: -6, width: 21, height: 11 }, "#142f44");
      ctx.strokeStyle = "#f4a65a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(5, -12);
      ctx.lineTo(0, 0);
      ctx.lineTo(12, 3);
      ctx.lineTo(7, 13);
      ctx.stroke();
      box(ctx, { x: 24, y: 4, width: 13, height: 8 }, "#718a9c");
      ctx.restore();
    }
    const ids = new Set(data.players.map((p) => p.id));
    for (const id of this.positions.keys())
      if (!ids.has(id)) this.positions.delete(id);
    for (const p of data.players) {
      if (p.in_vent) continue;
      let pos = this.positions.get(p.id) || { x: p.x, y: p.y };
      const dx = p.x - pos.x,
        dy = p.y - pos.y,
        blend = Math.hypot(dx, dy) > 150 ? 1 : Math.min(1, dt * 18);
      pos = { x: pos.x + dx * blend, y: pos.y + dy * blend };
      this.positions.set(p.id, pos);
      ctx.save();
      if (!p.alive) ctx.globalAlpha = 0.4;
      drawPlayer(
        ctx,
        {
          id: p.id,
          position: pos,
          color: palette[(p.color || 0) % 10],
          facing: dx < 0 ? -1 : 1,
          moving: Math.hypot(dx, dy) > 1,
          label: p.nickname,
        },
        time,
        p.id === playerId,
      );
      ctx.restore();
    }
    for (const e of data.effects || []) {
      const age = (time - Date.parse(e.at)) / 1000;
      if (age < 0 || age > 2) continue;
      ctx.strokeStyle = e.type === "kill" ? "#f4707a" : "#7ae6dc";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 20 + age * 40, 0, Math.PI * 2);
      ctx.stroke();
    }
    // A ray-cast mask matches wall and closed-door occlusion. Network filtering is authoritative.
    if (own.alive) {
      const radius = data.vision_radius || 520,
        walls = [
          ...station.walls,
          ...(data.doors || []).filter((d) => d.closed).map((d) => d.bounds),
        ];
      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x, view.y, view.width, view.height);
      const visionKey = [
        own.x,
        own.y,
        radius,
        ...(data.doors || []).filter((d) => d.closed).map((d) => d.id),
      ].join(",");
      if (visionKey !== this.visionKey) {
        this.visionKey = visionKey;
        const points: Vector2[] = [];
        for (let i = 0; i < 180; i++) {
          const angle = (i * Math.PI * 2) / 180,
            dx = Math.cos(angle),
            dy = Math.sin(angle);
          let distance = radius;
          for (const r of walls) {
            let low = 0,
              high = radius;
            for (const [origin, delta, min, max] of [
              [own.x, dx, r.x, r.x + r.width],
              [own.y, dy, r.y, r.y + r.height],
            ]) {
              if (Math.abs(delta) < 1e-8) {
                if (origin < min || origin > max) {
                  low = Infinity;
                  break;
                }
              } else {
                const a = (min - origin) / delta,
                  b = (max - origin) / delta;
                low = Math.max(low, Math.min(a, b));
                high = Math.min(high, Math.max(a, b));
              }
            }
            if (high >= low && low >= 0) distance = Math.min(distance, low);
          }
          points.push({ x: own.x + dx * distance, y: own.y + dy * distance });
        }
        this.visionPoints = points;
      }
      const points = this.visionPoints;
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(3,8,18,.93)";
      ctx.fill("evenodd");
      ctx.restore();
    }
    ctx.restore();
    const critical = data.sabotages?.find(
      (s) => s.kind === "reactor" || s.kind === "oxygen",
    );
    const panel = critical?.panels
      .filter((p) => !critical.repaired_panels.includes(p.id))
      .sort(
        (a, b) =>
          Math.hypot(a.x - own.x, a.y - own.y) -
          Math.hypot(b.x - own.x, b.y - own.y),
      )[0];
    if (panel) {
      const angle = Math.atan2(panel.y - own.y, panel.x - own.x),
        x = width / 2 + Math.cos(angle) * Math.min(width * 0.38, 210),
        y = height / 2 + Math.sin(angle) * Math.min(height * 0.35, 140);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = "#ff96a0";
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#ffb6bc";
      ctx.font = "600 13px sans-serif";
      ctx.fillText(`${critical!.kind} · аварийная панель`, x - 45, y + 28);
    }
    return { cacheSize: this.chunks.size, visiblePlayers: data.players.length };
  }
}
