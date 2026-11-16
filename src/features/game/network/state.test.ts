import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptSnapshot, type Snapshot } from "./types";
const snapshot = (game_id: string, state_version: number) =>
  ({ game_id, state_version }) as Snapshot;
test("stale snapshots never rewind a match; a reconnect can replace the game", () => {
  const current = snapshot("a", 10);
  assert.equal(acceptSnapshot(current, snapshot("a", 9)), current);
  assert.equal(acceptSnapshot(current, snapshot("a", 11)).state_version, 11);
  assert.equal(acceptSnapshot(current, snapshot("b", 1)).game_id, "b");
});
