import station from "./asterion.json";
import type { Rect, Vector2 } from "./types";
import type { Snapshot, Task } from "../network/types";
import { drawRoom, drawProp, drawRoomActivity } from "./asterion/RoomRenderer";
import {
  drawCorridor,
  drawDoorFrame,
  drawTaskEquipment,
} from "./asterion/StationFixtures";
import { drawPlayer } from "./render-world";
import { RemoteMotion } from "./remote-motion";
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
  "#f05d36",
  "#348f85",
  "#c88f5c",
  "#6684d8",
  "#df5792",
  "#bddd3e",
  "#debb42",
  "#a26bca",
  "#6e7c8e",
  "#e9cbb7",
];
const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
function box(ctx: CanvasRenderingContext2D, r: Rect, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.width, r.height);
}
export class StationRenderer {
  private overview: HTMLCanvasElement | null = null;
  private chunks = new Map<string, HTMLCanvasElement>();
  private visionKey = "";
  private visionAnchor: Vector2 | null = null;
  private visionPoints: Vector2[] = [];
  private cameraPosition: Vector2 | null = null;
  private doorProgress = new Map<string, number>();
  private positions = new Map<string, Vector2>();
  private remote = new Map<string, { motion: RemoteMotion; alive: boolean }>();
  private remoteSnapshot: Snapshot | null = null;
  private closedDoors: NonNullable<Snapshot["doors"]> = [];
  clear() {
    this.overview = null;
    this.visionKey = "";
    this.visionAnchor = null;
    this.visionPoints = [];
    this.chunks.clear();
    this.positions.clear();
    this.remote.clear();
    this.remoteSnapshot = null;
    this.closedDoors = [];
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
    for (const corridor of station.corridors)
      if (intersects(corridor.bounds, bounds)) drawCorridor(ctx, corridor);
    for (const room of station.rooms)
      if (intersects(room.bounds, bounds)) drawRoom(ctx, room);
    for (const prop of station.decorations)
      if (intersects(prop.bounds, bounds))
        drawProp(
          ctx,
          prop,
          station.rooms.find((r) => r.id === prop.room_id)!.visual.accentColor,
        );
    for (const door of station.doors)
      if (intersects(door.bounds, bounds)) drawDoorFrame(ctx, door);
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
    cameraView?: {
      x: number;
      y: number;
      radius: number;
      zoom?: number;
      review?: boolean;
      freeze?: boolean;
    },
    ownTasks?: Task[],
    predictedOwn?: Vector2 | null,
  ) {
    if (cameraView?.freeze) time = 1000;
    const serverOwn = cameraView
      ? { id: "camera-monitor", x: cameraView.x, y: cameraView.y, alive: true }
      : data.players.find((p) => p.id === playerId);
    const own = serverOwn && predictedOwn && !cameraView
      ? { ...serverOwn, x: predictedOwn.x, y: predictedOwn.y }
      : serverOwn;
    if (!own) return;
    const camera = this.cameraPosition || { x: own.x, y: own.y };
    const blend = Math.min(1, dt * 14);
    this.cameraPosition = {
      x: camera.x + (own.x - camera.x) * blend,
      y: camera.y + (own.y - camera.y) * blend,
    };
    const scale =
      cameraView?.zoom || Math.max(0.65, Math.min(1.1, width / 1000));
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
    if (cameraView?.review) {
      if (view.width > station.width) view.x = (station.width - view.width) / 2;
      if (view.height > station.height)
        view.y = (station.height - view.height) / 2;
    }
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-view.x, -view.y);
    if (cameraView?.review && scale < 0.5) {
      if (!this.overview) {
        const canvas = document.createElement("canvas");
        canvas.width = 1536;
        canvas.height = 1024;
        const layer = canvas.getContext("2d")!;
        layer.scale(0.25, 0.25);
        layer.fillStyle = "#090f1c";
        layer.fillRect(0, 0, 6144, 4096);
        for (const q of station.corridors) drawCorridor(layer, q);
        for (const q of station.rooms) drawRoom(layer, q);
        for (const q of station.decorations)
          drawProp(
            layer,
            q,
            station.rooms.find((r) => r.id === q.room_id)!.visual.accentColor,
          );
        for (const q of station.doors) drawDoorFrame(layer, q);
        this.overview = canvas;
      }
      ctx.drawImage(this.overview, 0, 0, station.width, station.height);
    } else {
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
    }
    const animatedTime = cameraView?.freeze ? 1000 : time;
    const emergencyActive =
      data.sabotages?.some((s) => ["reactor", "oxygen"].includes(s.kind)) ||
      false;
    for (const room of station.rooms)
      if (intersects(room.bounds, view))
        drawRoomActivity(
          ctx,
          room,
          animatedTime,
          emergencyActive,
          data.sabotages?.some((s) => s.kind === "comms") || false,
          data.sabotages?.some((s) => s.kind === "lights") || false,
        );
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
      const assignment = ownTasks?.find(
        (q) => Math.hypot(q.x - t.x, q.y - t.y) < 5,
      );
      drawTaskEquipment(
        ctx,
        t,
        Math.hypot(t.x - own.x, t.y - own.y) < 90,
        animatedTime,
        data.sabotages?.some((s) => s.kind === "comms") || false,
        ownTasks
          ? assignment?.is_completed
            ? "complete"
            : assignment
              ? "active"
              : "unavailable"
          : "active",
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
      ctx.fillStyle = palette[(b.color || 0) % palette.length];
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
    const remoteFrame = data !== this.remoteSnapshot;
    const now = performance.now();
    if (remoteFrame) {
      if (data.game_id !== this.remoteSnapshot?.game_id || data.phase !== this.remoteSnapshot?.phase) {
        this.remote.clear();
      }
      this.remoteSnapshot = data;
      this.closedDoors = (data.doors ?? []).filter((door) => door.closed);
    }
    const half = station.player_hitbox / 2;
    const outsideMap = ({ x, y }: Vector2) =>
      x < half || y < half || x + half > station.width || y + half > station.height;
    const blocked = (point: Vector2) => {
      const { x, y } = point;
      const overlaps = (r: Rect) =>
        x - half < r.x + r.width && x + half > r.x &&
        y - half < r.y + r.height && y + half > r.y;
      return outsideMap(point) ||
        station.walls.some(overlaps) ||
        this.closedDoors.some((door) => overlaps(door.bounds));
    };
    const settingSpeed = data.settings?.speed;
    const speed = typeof settingSpeed === "number" && Number.isFinite(settingSpeed)
      ? settingSpeed : station.speed;
    const ids = new Set(data.players.filter((p) => !p.in_vent).map((p) => p.id));
    for (const id of this.positions.keys())
      if (!ids.has(id)) this.positions.delete(id);
    for (const id of this.remote.keys())
      if (!ids.has(id)) this.remote.delete(id);
    for (const p of data.players) {
      if (p.in_vent) continue;
      const local = p.id === playerId && predictedOwn && !cameraView;
      let target = local ? predictedOwn : p;
      if (p.id !== playerId && !cameraView?.freeze) {
        let remote = this.remote.get(p.id);
        if (!remote || remote.alive !== p.alive) {
          remote = { alive: p.alive, motion: new RemoteMotion() };
          this.remote.set(p.id, remote);
          remote.motion.record(p, now);
        } else if (remoteFrame) {
          remote.motion.record(p, now);
        }
        target = remote.motion.position(now, speed, p.alive ? blocked : outsideMap);
      }
      let pos = this.positions.get(p.id) || { x: p.x, y: p.y };
      const dx = target.x - pos.x,
        dy = target.y - pos.y,
        blend = p.id !== playerId || local || Math.hypot(dx, dy) > 150
          ? 1 : Math.min(1, dt * 18);
      pos = { x: pos.x + dx * blend, y: pos.y + dy * blend };
      this.positions.set(p.id, pos);
      ctx.save();
      if (!p.alive) ctx.globalAlpha = 0.4;
      drawPlayer(
        ctx,
        {
          id: p.id,
          position: pos,
          color: palette[(p.color || 0) % palette.length],
          variant:p.color||0,
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
    // Keep known architecture and furniture readable. Server-filtered snapshots
    // remain authoritative for players, bodies and transient effects behind walls.
    if (serverOwn?.alive && !cameraView?.review) {
      const radius = cameraView?.radius || data.vision_radius || 520;
      const { x, y } = serverOwn;
      const closedDoors = this.closedDoors;
      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x, view.y, view.width, view.height);
      const visionKey = [
        radius,
        ...closedDoors.map((d) => d.id),
      ].join(",");
      const visionMoved = !this.visionAnchor ||
        Math.hypot(
          x - this.visionAnchor.x,
          y - this.visionAnchor.y,
        ) >= 12;
      if (visionKey !== this.visionKey || visionMoved) {
        this.visionKey = visionKey;
        this.visionAnchor = { x, y };
        const area = { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 };
        const walls = [
          ...station.walls.filter((wall) => intersects(wall, area)),
          ...closedDoors.map((door) => door.bounds),
        ];
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
              [x, dx, r.x, r.x + r.width],
              [y, dy, r.y, r.y + r.height],
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
          points.push({ x: x + dx * distance, y: y + dy * distance });
        }
        this.visionPoints = points;
      }
      const points = this.visionPoints;
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      const lightsOut = data.sabotages?.some((s) => s.kind === "lights");
      ctx.fillStyle = lightsOut ? "rgba(3,8,18,.55)" : "rgba(3,8,18,.18)";
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
