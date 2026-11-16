import test from "node:test";
import assert from "node:assert/strict";
import { readAudioPreferences } from "./AudioManager";
import { soundNames } from "./SoundRegistry";
test("audio storage rejects invalid types and clamps restored volumes", () => {
  assert.deepEqual(
    readAudioPreferences(
      '{"master":9,"music":-2,"effects":"loud","muted":"false"}',
    ),
    { master: 1, effects: 0.7, music: 0, muted: false },
  );
  assert.deepEqual(
    readAudioPreferences('{"master":0,"effects":0.25,"music":0,"muted":true}'),
    { master: 0, effects: 0.25, music: 0, muted: true },
  );
  assert.deepEqual(
    readAudioPreferences("null"),
    readAudioPreferences("broken-json"),
  );
});
test("sound registry has at least 25 distinct original events across all gameplay systems", () => {
  assert.ok(soundNames.length >= 25);
  assert.equal(new Set(soundNames).size, soundNames.length);
  for (const system of [
    "ui.",
    "room.",
    "vent.",
    "task.",
    "sabotage.",
    "meeting.",
    "game.",
  ])
    assert.ok(
      soundNames.some((n) => n.startsWith(system)),
      system,
    );
});
