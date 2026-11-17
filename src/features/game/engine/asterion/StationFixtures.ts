import station from "../asterion.json";
type C = CanvasRenderingContext2D;
function line(
  c: C,
  x: number,
  y: number,
  xx: number,
  yy: number,
  color: string,
  width = 3,
) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(xx, yy);
  c.stroke();
}
export function drawCorridor(
  c: C,
  corridor: (typeof station.corridors)[number],
) {
  const r = corridor.bounds,
    room = station.rooms.find((r) => r.id === corridor.rooms[0])!,
    color = room.visual.accentColor,
    horizontal = r.width > r.height,
    index = station.corridors.indexOf(corridor) % 8;
  c.save();
  c.fillStyle = index === 6 ? "#253d53" : "#293b49";
  c.fillRect(r.x, r.y, r.width, r.height);
  c.strokeStyle = "#152537";
  c.lineWidth = 12;
  c.strokeRect(r.x + 5, r.y + 5, r.width - 10, r.height - 10);
  const length = horizontal ? r.width : r.height;
  for (let n = 20; n < length; n += 42) {
    if (horizontal)
      line(c, r.x + n, r.y + 18, r.x + n, r.y + r.height - 18, "#8da5b422", 2);
    else
      line(c, r.x + 18, r.y + n, r.x + r.width - 18, r.y + n, "#8da5b422", 2);
  }
  if (horizontal) {
    line(c, r.x, r.y + 17, r.x + r.width, r.y + 17, color + "88", 4);
    line(
      c,
      r.x,
      r.y + r.height - 17,
      r.x + r.width,
      r.y + r.height - 17,
      color + "88",
      4,
    );
  } else {
    line(c, r.x + 17, r.y, r.x + 17, r.y + r.height, color + "88", 4);
    line(
      c,
      r.x + r.width - 17,
      r.y,
      r.x + r.width - 17,
      r.y + r.height,
      color + "88",
      4,
    );
  }
  if (index === 0 || index === 2 || index === 7) {
    for (let offset = 29; offset < 48; offset += 12) {
      if (horizontal)
        line(c, r.x, r.y + offset, r.x + r.width, r.y + offset, "#728e9b", 6);
      else
        line(c, r.x + offset, r.y, r.x + offset, r.y + r.height, "#728e9b", 6);
    }
  }
  c.fillStyle = color;
  c.font = "bold 12px sans-serif";
  c.textAlign = "center";
  c.translate(r.x + r.width / 2, r.y + r.height / 2);
  if (!horizontal) c.rotate(Math.PI / 2);
  c.fillText("› " + room.sector.toUpperCase() + " ›", 0, 4);
  c.restore();
}
export function drawDoorFrame(c: C, d: (typeof station.doors)[number]) {
  const r = d.bounds;
  c.save();
  c.fillStyle = "#182b3c";
  const vertical = r.height > r.width;
  c.fillRect(r.x - 8, r.y - 8, r.width + 16, r.height + 16);
  c.fillStyle = "#293b49";
  c.fillRect(r.x, r.y, r.width, r.height);
  c.strokeStyle = "#a8bdc8";
  c.lineWidth = 5;
  if (vertical) {
    line(c, r.x - 6, r.y - 4, r.x + r.width + 6, r.y - 4, "#a8bdc8", 5);
    line(
      c,
      r.x - 6,
      r.y + r.height + 4,
      r.x + r.width + 6,
      r.y + r.height + 4,
      "#a8bdc8",
      5,
    );
  } else {
    line(c, r.x - 4, r.y - 6, r.x - 4, r.y + r.height + 6, "#a8bdc8", 5);
    line(
      c,
      r.x + r.width + 4,
      r.y - 6,
      r.x + r.width + 4,
      r.y + r.height + 6,
      "#a8bdc8",
      5,
    );
  }
  c.restore();
}
export function drawTaskEquipment(
  c: C,
  t: (typeof station.tasks)[number],
  near: boolean,
  time: number,
  damaged: boolean,
  state: string = "active",
) {
  c.save();
  c.translate(t.x, t.y);
  c.strokeStyle = "#0e2437";
  c.lineWidth = 3;
  c.globalAlpha = state === "unavailable" ? 0.5 : 1;
  const kind = t.type,
    color = damaged ? "#eb8582" : near ? "#d5ff89" : "#80c9c5";
  if (near) {
    c.strokeStyle = "#d5ff8977";
    c.beginPath();
    c.ellipse(0, 8, 38, 23, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.strokeStyle = "#132c3c";
  c.fillStyle = ["medical_scan", "oxygen_filters"].includes(kind)
    ? "#c9dfd7"
    : "#7495a4";
  c.beginPath();
  c.roundRect(
    -25,
    -22,
    50,
    39,
    ["engine_calibration", "coolant_valves"].includes(kind) ? 17 : 7,
  );
  c.fill();
  c.stroke();
  c.fillStyle = color;
  if (kind === "medical_scan") {
    c.fillRect(-4, -14, 8, 22);
    c.fillRect(-11, -7, 22, 8);
  } else if (kind === "cargo_sorting" || kind === "fuel_distribution") {
    for (let i = 0; i < 3; i++) c.fillRect(-16 + i * 12, -12, 8, 19);
  } else if (kind === "engine_calibration" || kind === "coolant_valves") {
    c.strokeStyle = color;
    c.beginPath();
    c.arc(0, -3, 12, time / 1300, time / 1300 + Math.PI * 1.6);
    c.stroke();
  } else if (kind === "navigation_route" || kind === "antenna_alignment") {
    c.strokeStyle = color;
    c.beginPath();
    c.moveTo(-15, 8);
    c.lineTo(-4, -10);
    c.lineTo(13, -2);
    c.lineTo(5, 9);
    c.stroke();
  } else if (kind === "wires" || kind === "power_routing") {
    for (let i = 0; i < 3; i++) {
      line(
        c,
        -15 + i * 12,
        -12,
        -15 + i * 12,
        9,
        ["#ecb980", "#b9aadf", color][i],
        4,
      );
    }
  } else {
    c.fillRect(-17, -14, 34, 22);
    line(c, -12, -2, -5, -8, "#255263", 2);
    line(c, -5, -8, 10, 1, "#255263", 2);
  }
  if (near) {
    c.fillStyle = "#efffcc";
    c.font = "bold 13px sans-serif";
    c.textAlign = "center";
    c.fillText(state === "complete" ? "✓" : "!", 0, -33);
  }
  c.restore();
}
