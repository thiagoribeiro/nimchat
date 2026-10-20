import { test } from "node:test";
import assert from "node:assert/strict";
import { readBrianCache } from "../src/lib/brian-cache-format.ts";

const event = { event_id: "e", room_id: "r", room_seq: 1, type: "m.room.message", content: {} };

test("v4 restores the timeline with its sync cursor", () => {
  const v4 = JSON.stringify({ events: [event], cursor: "77", seen: {}, roomSeen: { r: 1 } });
  const cache = readBrianCache(v4, null);
  assert.equal(cache.cursor, "77");
  assert.deepEqual(cache.events, [event]);
  assert.deepEqual(cache.roomSeen, { r: 1 });
});
test("without v4, a v3 file keeps its prefs and has no cursor", () => {
  const v3 = JSON.stringify({ events: [], seen: { k: 2 }, expanded: { k: true } });
  const cache = readBrianCache(null, v3);
  assert.equal(cache.cursor, undefined);
  assert.deepEqual(cache.seen, { k: 2 });
  assert.deepEqual(cache.expanded, { k: true });
});
test("corrupt files fall back to an empty cache", () => {
  assert.deepEqual(readBrianCache("{oops", "[]"), { events: [], seen: {} });
  assert.equal(readBrianCache(JSON.stringify({ events: [], seen: {}, cursor: 5 }), null).cursor, undefined);
});
test("v4 keeps the last room list", () => {
  const rooms = [{ room_id: "r", name: "Sala", state: "join", role: "owner", join_rule: "invite" }];
  assert.deepEqual(readBrianCache(JSON.stringify({ events: [], seen: {}, rooms }), null).rooms, rooms);
  assert.equal(readBrianCache(JSON.stringify({ events: [], seen: {}, rooms: {} }), null).rooms, undefined);
});
