import station from "../asterion.json";
import type { Rect } from "../types";
export type Room = (typeof station.rooms)[number];
export type Prop = (typeof station.decorations)[number];
export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
function rounded(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  r = 10,
) {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
  c.stroke();
}
function ellipse(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
}
function line(
  c: CanvasRenderingContext2D,
  points: number[],
  color: string,
  width = 3,
) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
}
export function drawRoom(c: CanvasRenderingContext2D, r: Room) {
  const b = r.bounds,
    v = r.visual,
    color = v.accentColor;
  c.save();
  c.beginPath();
  for (const p of r.floor_parts) c.rect(p.x, p.y, p.width, p.height);
  c.clip();
  c.fillStyle = v.ambientLight;
  c.fillRect(b.x, b.y, b.width, b.height);
  c.translate(b.x, b.y);
  const m = v.floorMaterial;
  c.lineWidth = 2;
  c.strokeStyle = "#ffffff0d";
  // Sparse, readable material patterns; all are baked into bounded chunks.
  if (m === "reactor") {
    for (let rad = 90; rad < 550; rad += 85) {
      c.beginPath();
      c.arc(450, 260, rad, 0, Math.PI * 2);
      c.stroke();
    }
    for (let a = 0; a < 8; a++) {
      const t = (a * Math.PI) / 4;
      line(
        c,
        [450, 260, 450 + Math.cos(t) * 600, 260 + Math.sin(t) * 600],
        "#bc895429",
        8,
      );
    }
  } else if (m === "medical" || m === "laboratory") {
    c.fillStyle = m === "medical" ? "#bacdcb" : "#768e9b";
    c.fillRect(0, 0, 900, 520);
    for (let x = 0; x < 900; x += 90)
      for (let y = 0; y < 520; y += 90) {
        c.strokeStyle = "#213d4422";
        c.strokeRect(x + 3, y + 3, 84, 84);
        if (m === "laboratory" && (x + y) % 180 === 0) {
          c.fillStyle = "#d0e6e22a";
          c.fillRect(x + 8, y + 8, 73, 73);
        }
      }
    line(c, [50, 275, 850, 275], m === "medical" ? "#4a9b8c" : "#b3c8d1", 10);
  } else if (m === "greenhouse") {
    c.fillStyle = "#304c42";
    c.fillRect(0, 0, 900, 520);
    for (let y = 0; y < 520; y += 28) {
      line(c, [0, y, 900, y], "#718c6430", 3);
    }
    line(c, [30, 260, 870, 260], "#a6b68a22", 100);
  } else if (m === "cargo" || m === "transit") {
    for (let x = 0; x < 900; x += 100) {
      line(c, [x, 0, x, 520], "#9f9aa021", 3);
    }
    line(c, [0, 215, 900, 215], m === "transit" ? "#b8bec578" : "#d4af6240", 6);
    line(c, [0, 305, 900, 305], m === "transit" ? "#b8bec578" : "#d4af6240", 6);
    for (let x = 25; x < 900; x += 90) {
      line(c, [x, 215, x + 30, 230], "#eacb7070", 6);
    }
  } else if (m === "antistatic") {
    for (let x = 0; x < 900; x += 100)
      for (let y = 0; y < 520; y += 80) {
        c.strokeStyle = "#91b5d324";
        c.strokeRect(x + 5, y + 5, 90, 70);
        c.fillStyle = "#8fb5d744";
        c.fillRect(x + 12, y + 12, 4, 4);
      }
    line(c, [450, 0, 450, 520], "#6a99c63b", 14);
  } else if (m === "command" || m === "observatory") {
    for (let y = 0; y < 520; y += 95) {
      line(c, [0, y, 900, y], "#9faed51a", 2);
    }
    for (let x = 0; x < 900; x += 180) {
      line(c, [x, 0, x - 150, 520], "#9faed51a", 2);
    }
    ellipse(c, 450, 260, 230, 165, "#6984b010");
  } else if (m === "residential") {
    for (let y = 0; y < 520; y += 38) line(c, [0, y, 900, y], "#dfb58b16", 3);
    rounded(c, 290, 200, 320, 230, "#77718c38", 30);
  } else if (m === "nexus") {
    for (let rad = 100; rad < 470; rad += 100) {
      c.strokeStyle = "#83e4d924";
      c.beginPath();
      c.ellipse(450, 260, rad, rad * 0.72, 0, 0, Math.PI * 2);
      c.stroke();
    }
    line(c, [0, 260, 900, 260], "#83e4d925", 8);
    line(c, [450, 0, 450, 520], "#83e4d925", 8);
  } else {
    for (let x = 0; x < 900; x += 120)
      for (let y = 0; y < 520; y += 80) {
        c.strokeStyle = "#b7c7d31b";
        c.strokeRect(x + 3, y + 3, 114, 74);
        if (m === "grating")
          for (let n = 0; n < 7; n++)
            line(
              c,
              [x + 12 + n * 14, y + 14, x + 12 + n * 14, y + 65],
              "#0e202a40",
              5,
            );
      }
  }
  // Wall architecture follows the exact union contour, with no interior seams.
  c.restore();
  c.save();
  c.lineJoin = "round";
  for (const edge of r.outline) {
    line(c, edge, "#101b2b", 18);
    line(c, edge, v.wallMaterial === "clean" ? "#cfdfdc" : "#627a8c", 9);
    line(c, edge, color + "99", 3);
  }
  c.beginPath();
  for (const p of r.floor_parts) c.rect(p.x, p.y, p.width, p.height);
  c.clip();
  if (v.windows) {
    const wx = b.x + 270,
      wy = b.y + 8;
    c.strokeStyle = "#647d9c";
    c.lineWidth = 7;
    rounded(c, wx, wy, 360, 43, "#0b1530", 15);
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 3 ? "#cadffa" : "#ab98df";
      c.fillRect(
        wx + 12 + ((i * 71) % 330),
        wy + 8 + ((i * 13) % 25),
        i % 4 === 0 ? 3 : 1.5,
        2,
      );
    }
    line(c, [wx + 180, wy, wx + 180, wy + 43], "#728aa0", 5);
  }
  for (const l of v.lightSources) {
    const g = c.createRadialGradient(l.x, l.y, 1, l.x, l.y, l.radius);
    g.addColorStop(0, color + "21");
    g.addColorStop(1, color + "00");
    c.fillStyle = g;
    c.fillRect(l.x - l.radius, l.y - l.radius, l.radius * 2, l.radius * 2);
  }
  c.font = "bold 18px sans-serif";
  c.textAlign = "left";
  c.fillStyle = color;
  c.fillText(r.name.toUpperCase(), b.x + 95, b.y + 260 - 65);
  c.font = "11px sans-serif";
  c.fillStyle = "#c6d6e4a0";
  c.fillText(
    `${r.sector.toUpperCase()} / ${r.id.toUpperCase()}`,
    b.x + 95,
    b.y + 260 - 43,
  );
  c.restore();
}
export function drawProp(c: CanvasRenderingContext2D, p: Prop, color: string) {
  const b = p.bounds;
  c.save();
  c.translate(b.x, b.y);
  c.scale(b.width / 200, b.height / 130);
  c.strokeStyle = "#142333";
  c.lineWidth = 5;
  c.lineJoin = "round";
  const k = p.kind;
  // Each major machine has a distinctive silhouette and internal construction.
  if (k === "partition") {
    rounded(c, 0, 0, 200, 130, "#597787", 4);
    line(c, [20, 10, 180, 10], color, 7);
    line(c, [20, 110, 180, 110], "#243c4e", 9);
  } else if (
    [
      "switchboard",
      "toolwall",
      "cabinet",
      "locker",
      "medicine",
      "reagents",
    ].includes(k)
  ) {
    rounded(
      c,
      4,
      6,
      192,
      116,
      ["medicine", "reagents"].includes(k) ? "#c4d9d2" : "#7b919a",
      6,
    );
    for (let i = 0; i < 4; i++) {
      rounded(c, 15 + i * 45, 18, 38, 91, i % 2 ? "#3f5f70" : "#5a7c88", 4);
      line(c, [40 + i * 45, 48, 40 + i * 45, 75], color, 4);
    }
    if (k === "toolwall")
      for (let i = 0; i < 5; i++)
        line(c, [25 + i * 32, 25, 35 + i * 32, 85], "#e4c18b", 5);
    if (k === "medicine") {
      c.fillStyle = "#f0fff8";
      c.fillRect(92, 40, 16, 45);
      c.fillRect(78, 54, 44, 15);
    }
  } else if (k === "capacitor" || k === "battery") {
    rounded(c, 12, 8, 176, 114, "#6e7c8c", 25);
    for (let i = 0; i < 3; i++) {
      rounded(c, 27 + i * 52, 20, 40, 91, "#2b4053", 12);
      line(c, [47 + i * 52, 32, 47 + i * 52, 93], color, 7);
    }
    line(c, [60, 6, 60, 0], "#dce1cb", 12);
  } else if (k === "workbench" || k === "parts") {
    rounded(c, 4, 18, 192, 95, "#b3a07c", 8);
    line(c, [14, 108, 14, 128], "#4b6475", 12);
    line(c, [185, 108, 185, 128], "#4b6475", 12);
    line(c, [35, 42, 72, 73], "#d9e3de", 12);
    ellipse(c, 140, 62, 21, 21, "#6e8791");
    line(c, [92, 34, 105, 86], color, 7);
  } else if (k === "forklift" || k === "cart") {
    rounded(c, 45, 8, 120, 100, "#e3b677", 15);
    rounded(c, 65, 20, 70, 40, "#344e62", 9);
    line(c, [65, 110, 65, 130], "#b1c3c8", 9);
    line(c, [135, 110, 135, 130], "#b1c3c8", 9);
    for (const x of [35, 175]) rounded(c, x, 35, 20, 68, "#233649", 7);
  } else if (k === "crane") {
    line(c, [15, 115, 15, 18, 185, 18, 185, 115], "#dda45f", 15);
    line(c, [110, 18, 110, 75], "#91a9b9", 5);
    line(c, [90, 75, 90, 100, 130, 100, 130, 75], "#ccd7d4", 8);
  } else if (k === "pallet" || k === "luggage") {
    rounded(c, 4, 10, 192, 110, "#7d7564", 5);
    for (let i = 0; i < 3; i++) {
      rounded(c, 18 + i * 58, 27, 45, 70, i % 2 ? "#9c95b1" : "#b49b78", 6);
      line(c, [40 + i * 58, 30, 40 + i * 58, 94], "#4c5966", 4);
    }
  } else if (k === "suit") {
    ellipse(c, 100, 25, 35, 24, "#b3c6c9");
    rounded(c, 54, 46, 92, 66, "#9eb5b9", 20);
    line(c, [60, 63, 25, 103], color, 16);
    line(c, [140, 63, 175, 103], color, 16);
    line(c, [78, 110, 70, 130], "#6c8193", 19);
    line(c, [122, 110, 130, 130], "#6c8193", 19);
    rounded(c, 77, 13, 47, 22, "#2d5065", 10);
  } else if (k === "vending") {
    rounded(c, 20, 3, 160, 122, "#af859e", 10);
    rounded(c, 34, 17, 95, 76, "#294657", 5);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? color : "#d6ba7f";
      c.fillRect(44 + (i % 3) * 26, 27 + Math.floor(i / 3) * 30, 14, 21);
    }
    rounded(c, 43, 101, 78, 12, "#304b5d", 3);
    ellipse(c, 152, 54, 9, 8, "#d1e7df");
  } else if (k === "microscope") {
    rounded(c, 20, 102, 160, 20, "#d5e4dc");
    line(c, [145, 101, 145, 35, 80, 24], "#c2d8d9", 18);
    line(c, [80, 24, 60, 55], "#8bb5bc", 22);
    rounded(c, 45, 70, 90, 15, "#687f8f", 3);
  } else if (k === "containment") {
    rounded(c, 12, 8, 176, 112, "#657e8d", 20);
    rounded(c, 32, 22, 136, 77, "#7eb0ac", 12);
    ellipse(c, 100, 58, 31, 23, "#ad96c4");
    line(c, [45, 35, 150, 86], "#c9f1e655", 8);
  } else if (k === "computer" || k === "schedule") {
    rounded(c, 12, 5, 176, 88, "#778fa6", 8);
    rounded(c, 26, 18, 148, 60, "#203a53", 4);
    for (let i = 0; i < 3; i++)
      line(c, [40, 30 + i * 15, 150 - i * 18, 30 + i * 15], color, 4);
    rounded(c, 30, 103, 140, 18, "#a8b5bd", 5);
  } else if (k === "projection" || k === "planet") {
    ellipse(c, 100, 103, 65, 18, "#6e829a");
    ellipse(c, 100, 52, 48, 36, "#a3a0dd");
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(100, 52, 77, 13, -0.3, 0, Math.PI * 2);
    c.stroke();
  } else if (k === "alarm" || k === "signal" || k === "lamp") {
    rounded(c, 65, 6, 70, 115, "#758b99", 16);
    for (let i = 0; i < 3; i++)
      ellipse(c, 100, 28 + i * 36, 20, 14, ["#f1b28a", "#e7d897", color][i]);
  } else if (k === "gauge" || k === "pressure") {
    rounded(c, 8, 8, 184, 111, "#9bb6bc", 10);
    ellipse(c, 75, 63, 43, 40, "#dae4db");
    line(c, [75, 63, 95, 35], "#e58a72", 5);
    for (let i = 0; i < 3; i++)
      line(c, [140, 35 + i * 25, 173, 35 + i * 25], color, 6);
  } else if (k === "seeds" || k === "irrigation") {
    rounded(c, 12, 10, 176, 110, "#728a69", 14);
    for (let i = 0; i < 3; i++) {
      ellipse(c, 45 + i * 55, 66, 17, 30, "#bad09b");
      line(c, [45 + i * 55, 35, 45 + i * 55, 95], "#527d63", 4);
    }
  } else if (k === "core") {
    ellipse(c, 100, 68, 93, 58, "#202733");
    ellipse(c, 100, 60, 73, 48, "#b77d48");
    ellipse(c, 100, 55, 51, 35, "#583d3a");
    ellipse(c, 100, 52, 28, 24, color);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      line(
        c,
        [
          100 + Math.cos(a) * 55,
          60 + Math.sin(a) * 36,
          100 + Math.cos(a) * 85,
          60 + Math.sin(a) * 52,
        ],
        "#f7d59b",
        7,
      );
    }
  } else if (k === "turbine") {
    rounded(c, 5, 12, 190, 105, "#516575", 28);
    ellipse(c, 53, 62, 43, 42, "#233644");
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      line(c, [53, 62, 53 + Math.cos(a) * 32, 62 + Math.sin(a) * 32], color, 6);
    }
    for (let i = 0; i < 4; i++) rounded(c, 110 + i * 19, 28, 10, 69, color, 3);
  } else if (k === "tank" || k === "oxygenpack") {
    rounded(c, 23, 8, 154, 112, "#9db8c1", 35);
    rounded(c, 45, 20, 110, 83, "#3f848c", 25);
    for (let y = 35; y < 95; y += 18) line(c, [57, y, 143, y], color, 4);
    line(c, [100, 103, 100, 128], "#a5cbd2", 12);
  } else if (k === "transformer") {
    rounded(c, 8, 12, 184, 108, "#6b7782");
    for (let x = 30; x < 185; x += 35) {
      ellipse(c, x, 57, 13, 32, "#cab07d");
      line(c, [x, 16, x, 5], color, 5);
    }
    rounded(c, 65, 88, 70, 20, "#20333d", 3);
  } else if (k === "robotarm") {
    ellipse(c, 100, 105, 70, 20, "#506576");
    line(c, [100, 100, 55, 60, 125, 20, 165, 55], color, 20);
    for (const [x, y] of [
      [100, 100],
      [55, 60],
      [125, 20],
    ])
      ellipse(c, x, y, 11, 11, "#dae6e5");
    line(c, [150, 52, 170, 70, 190, 48], "#b4c6cb", 9);
  } else if (["commandtable", "starTable", "meetingtable"].includes(k)) {
    ellipse(c, 100, 78, 96, 45, "#344f63");
    ellipse(c, 100, 62, 90, 43, k === "commandtable" ? "#6c8aa2" : "#315c6b");
    c.strokeStyle = color;
    c.lineWidth = 2;
    if (k === "starTable") {
      for (let i = 0; i < 12; i++) {
        const x = 22 + ((i * 47) % 155),
          y = 35 + ((i * 29) % 50);
        ellipse(c, x, y, 3, 3, color);
      }
    } else {
      for (let i = 0; i < 5; i++)
        rounded(c, 45 + i * 23, 32 + (i % 2) * 16, 17, 20, "#8ce2d1", 3);
      line(c, [100, 17, 100, 100], color, 2);
    }
  } else if (k === "radio") {
    rounded(c, 8, 8, 184, 112, "#6a7e89");
    rounded(c, 25, 20, 100, 53, "#1d3545");
    for (let i = 0; i < 5; i++)
      line(c, [30 + i * 17, 60, 38 + i * 17, 30], color, 3);
    for (let i = 0; i < 3; i++) ellipse(c, 45 + i * 50, 95, 13, 13, "#acbbc4");
  } else if (
    k === "monitorwall" ||
    k === "stationdisplay" ||
    k === "waveform"
  ) {
    rounded(c, 3, 4, 194, 118, "#556b7e");
    for (let i = 0; i < (k === "monitorwall" ? 6 : 2); i++) {
      const cols = k === "monitorwall" ? 3 : 2;
      const x = 13 + (i % cols) * (178 / cols),
        y = 14 + Math.floor(i / cols) * 49;
      rounded(
        c,
        x,
        y,
        170 / cols - 6,
        k === "monitorwall" ? 40 : 90,
        "#163447",
        4,
      );
      line(
        c,
        [x + 5, y + 25, x + 18, y + 15, x + 29, y + 30, x + 39, y + 10],
        color,
        2,
      );
    }
  } else if (k === "telescope") {
    ellipse(c, 100, 95, 67, 28, "#68719c");
    line(c, [100, 94, 100, 48], "#b2b6c8", 17);
    c.save();
    c.translate(100, 50);
    c.rotate(-0.4);
    rounded(c, -78, -25, 155, 50, "#a9b8d2", 17);
    ellipse(c, 75, 0, 13, 25, "#74b4da");
    c.restore();
  } else if (k === "scanner") {
    rounded(c, 22, 35, 158, 83, "#ebf7ef", 25);
    rounded(c, 50, 50, 100, 50, "#87c7ba", 20);
    c.strokeStyle = "#5b968e";
    c.lineWidth = 16;
    c.beginPath();
    c.ellipse(88, 61, 45, 50, 0, Math.PI, Math.PI * 2);
    c.stroke();
    line(c, [20, 110, 180, 110], color, 6);
  } else if (k === "bed" || k === "pod") {
    rounded(c, 14, 7, 174, 112, k === "bed" ? "#d7e6dd" : "#7d8a9c", 24);
    rounded(c, 30, 19, 43, 85, "#ecf3ed", 15);
    rounded(c, 83, 19, 87, 85, k === "bed" ? "#72baac" : "#8f9fb7", 15);
    line(c, [92, 25, 158, 95], color, 3);
  } else if (k === "labbench") {
    rounded(c, 3, 10, 194, 110, "#c6d6d9");
    for (let i = 0; i < 4; i++) {
      line(c, [30 + i * 42, 30, 30 + i * 42, 75], "#b1e2dd", 12);
      ellipse(c, 30 + i * 42, 81, 13, 15, i % 2 ? "#98d3ac" : "#a4b1eb");
    }
    rounded(c, 25, 97, 150, 15, "#617f8c", 4);
  } else if (k === "garden" || k === "tree" || k === "plant") {
    ellipse(c, 100, 99, 95, 25, "#9b9d7c");
    for (let i = 0; i < 7; i++) {
      const x = 30 + ((i * 43) % 140),
        y = 25 + ((i * 29) % 65);
      line(c, [x, 100, x, y], "#608350", 5);
      ellipse(c, x - 9, y, 19, 13, "#73ad69");
      ellipse(c, x + 13, y - 8, 18, 15, "#9ac776");
    }
    if (k === "garden") {
      c.strokeStyle = "#b8e0cd77";
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(100, 70, 92, 57, 0, Math.PI, Math.PI * 2);
      c.stroke();
    }
  } else if (k === "filter") {
    rounded(c, 7, 7, 186, 115, "#8ebbb9");
    for (let x = 25; x < 190; x += 50) {
      rounded(c, x, 20, 35, 88, "#3c696e", 12);
      for (let y = 30; y < 100; y += 14)
        line(c, [x + 6, y, x + 28, y], color, 4);
    }
  } else if (k === "container" || k === "crate") {
    rounded(c, 7, 8, 186, 111, "#a47d5c", 7);
    for (let x = 25; x < 190; x += 30) line(c, [x, 16, x, 110], "#624e45", 5);
    rounded(c, 75, 37, 48, 40, "#e6c480", 3);
    line(c, [90, 45, 109, 65, 90, 65, 109, 45], "#70553c", 4);
  } else if (k === "shelf" || k === "rack" || k === "servers") {
    rounded(c, 5, 6, 190, 115, "#344c5e", 5);
    for (let y = 20; y < 115; y += 28) {
      rounded(c, 15, y, 170, 22, k === "servers" ? "#1b2e41" : "#9b8a74", 2);
      for (let x = 25; x < 180; x += 30) {
        c.fillStyle = k === "servers" ? color : "#d3bd98";
        c.fillRect(x, y + 6, k === "servers" ? 5 : 22, 10);
      }
    }
  } else if (k === "tram") {
    rounded(c, 3, 12, 194, 99, "#b8a3ce", 28);
    rounded(c, 23, 24, 110, 48, "#304e6b", 18);
    rounded(c, 149, 24, 27, 68, "#725f93", 8);
    for (const x of [40, 155]) ellipse(c, x, 111, 14, 10, "#283649");
  } else if (k === "blastgate") {
    rounded(c, 2, 3, 196, 120, "#687989", 8);
    rounded(c, 19, 17, 162, 93, "#2a3b4a", 4);
    line(c, [100, 18, 100, 109], color, 7);
    for (let y = 24; y < 110; y += 25) {
      line(c, [24, y, 58, y + 15], "#e8ba78", 6);
      line(c, [142, y, 176, y + 15], "#e8ba78", 6);
    }
  } else if (k === "sofa" || k === "bench") {
    rounded(c, 4, 12, 192, 104, "#657482", 25);
    rounded(c, 25, 25, 150, 68, k === "sofa" ? "#b6a0b1" : "#8196a1", 17);
    line(c, [100, 30, 100, 85], "#4c5f70", 4);
  } else if (
    k === "pipe" ||
    k === "cable" ||
    k === "rails" ||
    k === "barrier"
  ) {
    for (let y = 30; y < 120; y += 35) {
      line(c, [5, y, 195, y], k === "rails" ? "#a0b2bb" : "#536b75", 15);
      line(c, [10, y - 3, 190, y - 3], color, 4);
    }
    if (k === "barrier")
      for (let x = 25; x < 180; x += 30)
        line(c, [x, 20, x + 15, 110], "#eec888", 6);
  } else if (k === "chair") {
    rounded(c, 20, 5, 160, 80, "#627d96", 30);
    rounded(c, 35, 87, 130, 35, "#9ab4c2", 15);
  } else if (
    k === "emblem" ||
    k === "route" ||
    k === "hazard" ||
    k === "grate" ||
    k === "condensation"
  ) {
    c.strokeStyle = color + "66";
    c.lineWidth = 3;
    for (let i = 0; i < 5; i++)
      line(c, [20 + i * 35, 15, 20 + i * 35, 115], color + "55", 3);
    if (k === "emblem") {
      c.font = "bold 27px sans-serif";
      c.fillStyle = color;
      c.textAlign = "center";
      c.fillText("ASTERION", 100, 75);
    }
  } else {
    rounded(
      c,
      10,
      10,
      180,
      110,
      ["medicine", "sink", "lamp"].includes(k) ? "#becfca" : "#6b8190",
      12,
    );
    rounded(c, 28, 24, 95, 65, "#243f50", 6);
    if (["fan", "centrifuge", "pump", "compressor", "optics"].includes(k)) {
      ellipse(c, 76, 61, 32, 28, color);
      line(c, [52, 42, 100, 80], "#253c4b", 6);
      line(c, [52, 80, 100, 42], "#253c4b", 6);
    } else {
      for (let i = 0; i < 3; i++) {
        rounded(c, 35 + i * 24, 37, 13, 37, i % 2 ? "#c7ddd5" : color, 3);
      }
    }
    for (let i = 0; i < 3; i++) ellipse(c, 153, 35 + i * 28, 6, 6, color);
  }
  c.restore();
}
export function drawRoomActivity(
  c: CanvasRenderingContext2D,
  r: Room,
  time: number,
  critical: boolean,
  comms: boolean,
  lights: boolean,
) {
  const b = r.bounds,
    v = r.visual,
    t = time / 1000,
    color = critical ? "#ff7975" : v.accentColor;
  c.save();
  c.beginPath();
  for (const part of r.floor_parts)
    c.rect(part.x, part.y, part.width, part.height);
  c.clip();
  c.globalAlpha = lights ? 0.2 : 0.65;
  for (let i = 0; i < 2; i++) {
    const l = v.lightSources[i];
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(l.x, l.y, 9, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = (lights ? 0.1 : 0.25) + Math.sin(t * 2 + i) * 0.08;
    c.beginPath();
    c.ellipse(l.x, l.y, 26, 9, 0, 0, Math.PI * 2);
    c.fill();
  }
  const p = station.decorations.find((p) => p.id === r.id + "-prop0");
  if (p) {
    const q = p.bounds,
      x = q.x + q.width / 2,
      y = q.y + q.height / 2;
    c.globalAlpha = 0.55;
    c.strokeStyle = comms && r.id === "comms" ? "#ff847a" : color;
    c.lineWidth = 3;
    c.beginPath();
    if (["core", "turbine", "telescope", "centrifuge"].includes(p.kind)) {
      c.ellipse(
        x,
        y,
        q.width * 0.26,
        q.height * 0.27,
        t * 0.6,
        0,
        Math.PI * 1.3,
      );
    } else {
      c.moveTo(q.x + 15, y + Math.sin(t * 2) * q.height * 0.2);
      c.lineTo(q.x + q.width - 15, y + Math.sin(t * 2) * q.height * 0.2);
    }
    c.stroke();
  }
  if (critical) {
    c.fillStyle = "#ee666619";
    c.fillRect(b.x, b.y, b.width, b.height);
  }
  c.restore();
}
