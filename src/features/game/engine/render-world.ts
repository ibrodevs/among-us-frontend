import type { calculateCamera } from "./camera";
import { mapConfig } from "./map-config";
import type { PlayerVisualState, Rect } from "./types";

function block(ctx: CanvasRenderingContext2D, rect: Rect, color: string, radius = 10, stroke?: string) {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string, radius = 8, stroke?: string) {
  block(ctx, { x, y, width, height }, color, radius, stroke);
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, points: number[], color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function equipment(ctx: CanvasRenderingContext2D, rect: Rect, color: string, kind: number) {
  ctx.save();
  ctx.translate(rect.x, rect.y);
  const { width: w, height: h } = rect;
  box(ctx, 0, 0, w, h, "#0c1b34", 11, "#101e38");
  box(ctx, 4, 4, w - 8, h - 13, "#304865", 8);
  if (kind === 2) {
    box(ctx, 12, 12, w - 24, h - 31, "#e49a65");
    for (let x = 22; x < w - 18; x += 20) box(ctx, x, 20, 8, h - 47, "#ffe4a3", 4);
    box(ctx, 43, 11, w - 86, h - 28, "#a76455", 6, "#17293e");
    box(ctx, 55, 22, w - 110, h - 50, "#ffb777", 5);
  } else if (kind === 3) {
    box(ctx, 12, 12, w - 24, h - 31, "#c0f1e9", 10);
    box(ctx, 23, 20, 25, h - 47, "#60b6c4", 6);
    box(ctx, 54, 20, w - 77, h - 47, "#effcfa", 6);
    line(ctx, [w - 42, h / 2 - 10, w - 42, h / 2 + 2], "#379898", 4);
    line(ctx, [w - 48, h / 2 - 4, w - 36, h / 2 - 4], "#379898", 4);
  } else {
    box(ctx, 11, 11, w - 22, h - 35, "#142741", 5, "#172339");
    if (kind === 1) {
      const cy = Math.round((h - 14) / 2);
      line(ctx, [20, cy, 34, cy, 43, cy - 10, 52, cy + 8, 62, cy - 6, 72, cy, w - 22, cy], color, 3);
    } else {
      for (let x = 20; x < w - 18; x += 19) {
        const height = Math.min(h - 46, 9 + x % 26);
        box(ctx, x, h - 30 - height, 10, height, color, 3);
      }
      line(ctx, [16, h - 28, w - 16, h - 28], "#587c9a", 2);
    }
    for (let x = 20; x < 50; x += 12) disc(ctx, x, h - 16, 3, color);
    box(ctx, w - 41, h - 19, 26, 6, "#8098b1", 3);
  }
  ctx.restore();
}

export function paintStation(ctx: CanvasRenderingContext2D) {
  const { width, height, zones, corridors, walls, taskPoints } = mapConfig;
  ctx.fillStyle = "#111d36";
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 175; i++) {
    const x = (i * 317 + i * i * 53) % width;
    const y = (i * 191 + i * i * 17) % height;
    disc(ctx, x, y, i % 13 === 0 ? 3 : 1.5, i % 13 === 0 ? "#8faac3" : "#3d5474");
  }

  const roomsAndPassages = [...zones.map(zone => zone.bounds), ...corridors];
  ctx.save();
  ctx.beginPath();
  for (const rect of roomsAndPassages) ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = "#0a1327";
  ctx.lineWidth = 32;
  ctx.stroke();
  ctx.strokeStyle = "#46617c";
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.clip();

  for (const zone of zones) {
    const { x, y, width, height } = zone.bounds;
    ctx.fillStyle = zone.floor;
    ctx.fillRect(x, y, width, height);
    box(ctx, x + 13, y + 13, width - 26, height - 26, zone.floor, 10, "#ffffff20");
    for (let offset = 30; offset < width - 18; offset += 42) {
      line(ctx, [x + offset, y + 52, x + offset, y + height - 15], "#101b3633", 2);
    }
    for (let offset = 64; offset < height - 15; offset += 42) {
      line(ctx, [x + 15, y + offset, x + width - 15, y + offset], "#101b3633", 2);
    }
    box(ctx, x + 25, y + 24, 10, 25, zone.color, 3);
    ctx.font = "800 26px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = zone.color;
    ctx.fillText(zone.name.toUpperCase(), x + 47, y + 37);
    for (let n = 0; n < 4; n++) box(ctx, x + width - 78 + n * 12, y + 30, 6, 15, "#ffffff38", 2);
  }

  for (const [i, rect] of corridors.entries()) {
    ctx.fillStyle = "#314664";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    if (i === 2) {
      for (let x = rect.x + 30; x < rect.x + rect.width; x += 35) {
        box(ctx, x, 446, 16, 6, "#637e98", 3);
      }
    } else {
      for (let y = rect.y + 5; y < rect.y + rect.height - 5; y += 21) {
        box(ctx, rect.x + 9, y, 9, 10, "#a2c4d3", 3);
        box(ctx, rect.x + rect.width - 18, y, 9, 10, "#a2c4d3", 3);
      }
    }
  }

  const fixtures = walls.slice(-zones.length * 2);
  fixtures.forEach((rect, index) => {
    const kind = Math.floor(index / 2);
    equipment(ctx, rect, zones[kind].color, kind);
  });
  taskPoints.forEach(({ position: { x, y } }, index) => {
    disc(ctx, x, y, 11, "#10253b");
    disc(ctx, x, y, 7, zones[index].color);
    disc(ctx, x, y, 3, "#10253b");
  });
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerVisualState, time: number, local: boolean) {
  const { x, y } = player.position;
  ctx.save();
  ctx.translate(x, y);
  if (local) {
    ctx.beginPath();
    ctx.ellipse(0, 10, 25, 13, 0, 0, 2 * Math.PI);
    ctx.fillStyle = "#16333d";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#a5ed6e";
    ctx.stroke();
  }
  ctx.save();
  ctx.scale(player.facing, 1);
  const step = player.moving ? Math.sin(time / 70) * 3 : 0;
  const outline = "#09172d";
  box(ctx, -12, 3 + step, 9, 13, player.color, 4, outline);
  box(ctx, 4, 3 - step, 9, 13, player.color, 4, outline);
  box(ctx, -21, -19, 11, 20, "#94a5bc", 5, outline);
  box(ctx, -15, -26, 32, 35, player.color, 12, outline);
  line(ctx, [-7, -24, -10, -33], outline, 4);
  disc(ctx, -10, -34, 5, player.color);
  box(ctx, -6, -20, 24, 14, "#192f4c", 5, outline);
  box(ctx, 0, -17, 10, 4, "#a9edff", 2);
  ctx.restore();
  ctx.font = "800 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.ceil(ctx.measureText(player.label).width) + 24;
  box(ctx, -width / 2, -66, width, 25, local ? "#d7ffb8" : "#172945", 8);
  ctx.fillStyle = local ? "#16351e" : "#f1f6ff";
  ctx.fillText(player.label, 0, -53);
  ctx.restore();
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  scenery: HTMLCanvasElement,
  crew: readonly PlayerVisualState[],
  player: PlayerVisualState,
  camera: ReturnType<typeof calculateCamera>,
  time: number,
) {
  ctx.save();
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(-camera.x, -camera.y);
  ctx.drawImage(scenery, 0, 0);
  for (const npc of crew) drawPlayer(ctx, npc, time, false);
  drawPlayer(ctx, player, time, true);
  ctx.restore();
}

export function renderRadar(ctx: CanvasRenderingContext2D, player: PlayerVisualState, camera: ReturnType<typeof calculateCamera>, viewport: { width: number; height: number }) {
  const { width, height, zones, corridors } = mapConfig;
  ctx.clearRect(0, 0, width, height);
  for (const corridor of corridors) block(ctx, corridor, "#4c6580", 0);
  for (const zone of zones) block(ctx, zone.bounds, zone.color, 26);
  ctx.strokeStyle = "#ffffffbb";
  ctx.lineWidth = 12;
  ctx.strokeRect(camera.x + 6, camera.y + 6, viewport.width / camera.scale - 12, viewport.height / camera.scale - 12);
  disc(ctx, player.position.x, player.position.y, 58, "#142746");
  disc(ctx, player.position.x, player.position.y, 39, "#a5ed6e");
}
