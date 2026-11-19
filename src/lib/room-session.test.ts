import assert from "node:assert/strict";
import { test } from "node:test";
import { forgetRoom, readRoomSession, rememberRoom } from "./room-session";

test("room recovery belongs to the same guest and explicit leave clears only that room", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  const guest = { player_id: "one", token: "test", nickname: "Explorer" };
  try {
    assert.equal(readRoomSession(guest), null);
    rememberRoom(guest, "ABC234");
    assert.equal(readRoomSession(guest), "ABC234");
    assert.equal(readRoomSession({ ...guest, player_id: "other" }), null);
    assert.equal(readRoomSession(null), null);
    forgetRoom("OTHER1");
    assert.equal(readRoomSession(guest), "ABC234");
    forgetRoom("ABC234");
    assert.equal(readRoomSession(guest), null);
    rememberRoom(guest, "../bad");
    assert.equal(readRoomSession(guest), null);
    rememberRoom(guest, "ABC234");
    forgetRoom();
    assert.equal(readRoomSession(guest), null);
    values.set("crew-mission-room-v1", "{broken");
    assert.equal(readRoomSession(guest), null);
    storage.getItem = () => { throw new Error("Storage disabled"); };
    storage.setItem = () => { throw new Error("Storage disabled"); };
    assert.equal(readRoomSession(guest), null);
    assert.doesNotThrow(() => rememberRoom(guest, "ABC234"));
    assert.doesNotThrow(() => forgetRoom());
  } finally {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});
