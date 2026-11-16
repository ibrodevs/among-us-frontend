import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCamera } from "./camera";
import { detectCollision, PLAYER_HITBOX } from "./collision";
import { readDirection } from "./input";
import { contains, mapConfig } from "./map-config";
import { DEMO_SPEED, MAX_DELTA_SECONDS, updateMovement } from "./movement";
import type { MapConfig, Vector2 } from "./types";

const openMap: MapConfig = { ...mapConfig, walls: [] };
const start = { x: 400, y: 600 };

function travel(origin: Vector2, direction: Vector2, seconds: number, fps: number, map = openMap) {
  let position = origin;
  for (let frame = 0; frame < seconds * fps; frame++) {
    position = updateMovement(position, direction, 1 / fps, map);
  }
  return position;
}

function around(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} ≠ ${expected}`);
}

test("150 px/s in every cardinal direction at 30, 60 and 144 fps", () => {
  for (const fps of [30, 60, 144]) {
    for (const [x, y] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {
      const end = travel(start, { x, y }, 1, fps);
      around(end.x, start.x + x * DEMO_SPEED);
      around(end.y, start.y + y * DEMO_SPEED);
    }
  }
});

test("diagonal input has the same speed as cardinal input", () => {
  const end = travel(start, { x: 1, y: -1 }, 1, 60);
  around(Math.hypot(end.x - start.x, end.y - start.y), DEMO_SPEED);
});

test("a delayed frame is capped and idle input preserves position", () => {
  const end = updateMovement(start, { x: 1, y: 0 }, 2, openMap);
  around(end.x - start.x, DEMO_SPEED * MAX_DELTA_SECONDS);
  assert.deepEqual(updateMovement(start, { x: 0, y: 0 }, 1, openMap), start);
});

test("world bounds and equipment block the full hitbox", () => {
  const half = PLAYER_HITBOX / 2;
  assert.equal(detectCollision({ x: half, y: half }, openMap), false);
  assert.equal(detectCollision({ x: half - 1, y: half }, openMap), true);
  assert.equal(detectCollision({ x: mapConfig.width - half + 1, y: 100 }, openMap), true);
  assert.equal(detectCollision({ x: 100, y: mapConfig.height - half + 1 }, openMap), true);
  const end = travel(mapConfig.spawnPoints[0], { x: -1, y: 0 }, 4, 60, mapConfig);
  assert.ok(end.x >= 334 + half && end.x < 334 + half + 3);
});

test("passages connect the four rooms and wall contact allows sliding", () => {
  let point = travel(mapConfig.spawnPoints[0], { x: 0, y: 1 }, 1, 60, mapConfig);
  point = travel(point, { x: 1, y: 0 }, 4.9, 60, mapConfig);
  assert.ok(point.x > 1110);
  for (const [direction, room] of [[-1, 1], [1, 3]]) {
    const destination = travel(point, { x: 0, y: direction }, 1, 60, mapConfig);
    assert.ok(contains(mapConfig.zones[room].bounds, destination));
  }
  assert.ok(contains(mapConfig.zones[2].bounds, travel(mapConfig.spawnPoints[0], { x: 0, y: 1 }, 2, 60, mapConfig)));
  const end = updateMovement({ x: 348, y: 260 }, { x: -1, y: 1 }, 1 / 60, mapConfig);
  assert.equal(end.x, 348);
  assert.ok(end.y > 260);
});

test("camera follows the player and clamps at all edges for wide and narrow viewports", () => {
  for (const viewport of [{ width: 886, height: 498 }, { width: 342, height: 292 }]) {
    const origin = calculateCamera({ x: 0, y: 0 }, viewport, mapConfig);
    assert.equal(origin.x, 0);
    assert.equal(origin.y, 0);
    const middle = calculateCamera({ x: 800, y: 450 }, viewport, mapConfig);
    around(middle.x + viewport.width / middle.scale / 2, 800);
    around(middle.y + viewport.height / middle.scale / 2, 450);
    const far = calculateCamera({ x: 1600, y: 900 }, viewport, mapConfig);
    around(far.x + viewport.width / far.scale, mapConfig.width);
    around(far.y + viewport.height / far.scale, mapConfig.height);
  }
});

test("independent keyboard and pointer inputs can combine and cancel directions", () => {
  const input = {
    keys: new Map([["KeyD", "right"], ["ArrowRight", "right"]] as const),
    pointers: new Map([[10, "up"], [20, "left"]] as const),
  };
  assert.deepEqual(readDirection(input), { x: 0, y: -1 });
  input.pointers.delete(20);
  input.keys.delete("KeyD");
  assert.deepEqual(readDirection(input), { x: 1, y: -1 });
});
