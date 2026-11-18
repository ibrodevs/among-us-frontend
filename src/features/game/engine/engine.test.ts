import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCamera } from "./camera";
import { detectCollision, PLAYER_HITBOX } from "./collision";
import { readDirection } from "./input";
import { contains, mapConfig } from "./map-config";
import { DEMO_SPEED, MAX_DELTA_SECONDS, updateMovement } from "./movement";
import { LocalMotionPredictor } from "./local-prediction";
import { RemoteMotion } from "./remote-motion";
import type { MapConfig, Vector2 } from "./types";

const openMap: MapConfig = { ...mapConfig, walls: [] };
const start = { x: 400, y: 600 };

function travel(
  origin: Vector2,
  direction: Vector2,
  seconds: number,
  fps: number,
  map = openMap,
) {
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
    for (const [x, y] of [
      [0, -1],
      [-1, 0],
      [0, 1],
      [1, 0],
    ]) {
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
  assert.equal(
    detectCollision({ x: mapConfig.width - half + 1, y: 100 }, openMap),
    true,
  );
  assert.equal(
    detectCollision({ x: 100, y: mapConfig.height - half + 1 }, openMap),
    true,
  );
  const end = travel(
    mapConfig.spawnPoints[0],
    { x: -1, y: 0 },
    4,
    60,
    mapConfig,
  );
  assert.ok(end.x >= 334 + half && end.x < 334 + half + 3);
});

test("passages connect the four rooms and wall contact allows sliding", () => {
  let point = travel(
    mapConfig.spawnPoints[0],
    { x: 0, y: 1 },
    1,
    60,
    mapConfig,
  );
  point = travel(point, { x: 1, y: 0 }, 4.9, 60, mapConfig);
  assert.ok(point.x > 1110);
  for (const [direction, room] of [
    [-1, 1],
    [1, 3],
  ]) {
    const destination = travel(point, { x: 0, y: direction }, 1, 60, mapConfig);
    assert.ok(contains(mapConfig.zones[room].bounds, destination));
  }
  assert.ok(
    contains(
      mapConfig.zones[2].bounds,
      travel(mapConfig.spawnPoints[0], { x: 0, y: 1 }, 2, 60, mapConfig),
    ),
  );
  const end = updateMovement(
    { x: 348, y: 260 },
    { x: -1, y: 1 },
    1 / 60,
    mapConfig,
  );
  assert.equal(end.x, 348);
  assert.ok(end.y > 260);
});

test("camera follows the player and clamps at all edges for wide and narrow viewports", () => {
  for (const viewport of [
    { width: 886, height: 498 },
    { width: 342, height: 292 },
  ]) {
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
    keys: new Map([
      ["KeyD", "right"],
      ["ArrowRight", "right"],
    ] as const),
    pointers: new Map([
      [10, "up"],
      [20, "left"],
    ] as const),
  };
  assert.deepEqual(readDirection(input), { x: 0, y: -1 });
  input.pointers.delete(20);
  input.keys.delete("KeyD");
  assert.deepEqual(readDirection(input), { x: 1, y: -1 });
});

test("analog input preserves partial strength and combines within server bounds", () => {
  const input = {
    keys: new Map<string, "right">([["KeyD", "right"]]),
    pointers: new Map<number, "up">(),
    analog: { x: 0.6, y: -0.4 },
  };
  assert.deepEqual(readDirection(input), { x: 1, y: -0.4 });
  const position = { x: 800, y: 450 },
    next = updateMovement(position, { x: 0.5, y: 0 }, 0.05, mapConfig, 220);
  around(next.x - position.x, 5.5);
});


test("local prediction responds immediately without changing authoritative snapshots", () => {
  const predictor = new LocalMotionPredictor();
  const original = { x: 300, y: 300 };
  predictor.sync(original, 1, "game-1");
  const next = predictor.advance({ x: 1, y: 0 }, 1 / 60, openMap, [], 220);
  assert.ok(next && next.x > original.x, "input should move the sprite immediately");
  assert.deepEqual(original, { x: 300, y: 300 }, "server state must not mutate");
});

test("local prediction respects walls and server-closed doors", () => {
  const predictor = new LocalMotionPredictor();
  const geometry = {
    width: 1000,
    height: 1000,
    walls: [{ x: 330, y: 100, width: 30, height: 500 }],
  };
  predictor.sync({ x: 310, y: 300 }, 1, "walls");
  for (let i = 0; i < 10; i++) {
    predictor.advance({ x: 1, y: 0 }, 1 / 60, geometry, [], 220);
  }
  const blocked = predictor.advance({ x: 0, y: 0 }, 0, geometry, [], 220);
  assert.ok(blocked && blocked.x <= 316, "player hitbox must not enter a wall");

  const doorPredictor = new LocalMotionPredictor();
  doorPredictor.sync({ x: 310, y: 300 }, 1, "doors");
  for (let i = 0; i < 10; i++) {
    doorPredictor.advance(
      { x: 1, y: 0 },
      1 / 60,
      { ...geometry, walls: [] },
      geometry.walls,
      220,
    );
  }
  const closed = doorPredictor.advance(
    { x: 0, y: 0 },
    0,
    geometry,
    [],
    220,
  );
  assert.ok(closed && closed.x <= 316, "locked doors must stop prediction");
});

test("local prediction is bounded without authoritative updates", () => {
  const predictor = new LocalMotionPredictor();
  const base = { x: 300, y: 300 };
  predictor.sync(base, 1, "game-1");
  let next = base;
  for (let i = 0; i < 120; i++) {
    next = predictor.advance({ x: 1, y: 0 }, 1 / 60, openMap, [], 220)!;
  }
  assert.ok(next.x - base.x <= 220 * 0.24 + 0.00001);
  assert.equal(next.y, base.y);
});

test("local prediction resets after a server teleport and a new game", () => {
  const predictor = new LocalMotionPredictor();
  predictor.sync({ x: 300, y: 300 }, 1, "game-1");
  predictor.advance({ x: 1, y: 0 }, 0.05, openMap, [], 220);
  predictor.sync({ x: 700, y: 700 }, 2, "game-1");
  assert.deepEqual(
    predictor.advance({ x: 0, y: 0 }, 0, openMap, [], 220),
    { x: 700, y: 700 },
  );
  predictor.sync({ x: 400, y: 500 }, 1, "game-2");
  assert.deepEqual(
    predictor.advance({ x: 0, y: 0 }, 0, openMap, [], 220),
    { x: 400, y: 500 },
  );
});

test("local ghost prediction ignores furniture but still stays inside the world", () => {
  const geometry = {
    width: 1000,
    height: 1000,
    walls: [{ x: 330, y: 100, width: 30, height: 500 }],
  };
  const predictor = new LocalMotionPredictor();
  predictor.sync({ x: 310, y: 300 }, 1, "ghost");
  let next = { x: 310, y: 300 };
  for (let i = 0; i < 10; i++) {
    next = predictor.advance({ x: 1, y: 0 }, 1 / 60, geometry, [], 220, true)!;
  }
  assert.ok(next.x > 330, "ghosts may cross physical walls");
});

test("remote motion buffers snapshots and bounds extrapolation", () => {
  const motion = new RemoteMotion();
  const clear = () => false;
  motion.record({ x: 100, y: 50 }, 0);
  motion.record({ x: 120, y: 50 }, 100);
  assert.equal(motion.position(160, 220, clear).x, 110);
  assert.equal(motion.position(260, 220, clear).x, 129);
  assert.equal(motion.position(260, 220, ({ x }) => x > 125).x, 120);
  motion.record({ x: 600, y: 50 }, 200);
  assert.equal(motion.position(200, 220, clear).x, 600);
});

test("reconciliation replays pending input once and drops acknowledged input", () => {
  const predictor = new LocalMotionPredictor();
  const start = { x: 300, y: 300 }, right = { x: 1, y: 0 };
  predictor.sync(start, 1, "game", 1);
  const predicted = predictor.advance(right, 0.05, openMap, [], 220, false, 2)!;

  predictor.sync(start, 2, "game", 1);
  assert.equal(predictor.advance(right, 0, openMap, [], 220)!.x, predicted.x);

  predictor.sync(start, 3, "game", 2);
  assert.ok(predictor.advance(right, 0, openMap, [], 220)!.x < predicted.x);
});
