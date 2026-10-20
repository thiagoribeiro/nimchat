import assert from "node:assert/strict";
import test from "node:test";
import { NimletClient } from "../src/client.ts";
import { InMemoryTokenStorage } from "../src/storage.ts";
import { SyncEngine } from "../src/sync.ts";
import { cachedRooms, createTimelinePersister, retainTimeline, validSnapshot } from "../src/timeline-cache.ts";
import type { TimelineSnapshot } from "../src/timeline-cache.ts";
import type { NimletEvent } from "../src/types.ts";

const event = (room: string, seq: number, type = "m.room.message", content: unknown = {}): NimletEvent => ({
  event_id: `${room}:${seq}`,
  room_seq: seq,
  room_id: room,
  sender_id: "u",
  sender_display_name: "U",
  type,
  content,
  origin_server_ts: seq,
});
const range = (room: string, n: number) => Array.from({ length: n }, (_, i) => event(room, i + 1));

test("keeps the newest events of each room", () => {
  const kept = retainTimeline({ a: range("a", 150), b: range("b", 3) }, { perRoom: 100 });
  const a = kept.filter((e) => e.room_id === "a").map((e) => e.room_seq);
  assert.equal(a.length, 100);
  assert.equal(a[0], 51);
  assert.equal(a.at(-1), 150);
  assert.equal(kept.filter((e) => e.room_id === "b").length, 3);
});

test("keeps the first and last pinned event per key outside the window", () => {
  const events = [
    event("a", 1, "state", { k: "x" }),
    event("a", 2, "state", { k: "x" }),
    event("a", 3, "state", { k: "x" }),
    event("a", 4, "state", { k: "y" }),
    ...range("a", 10).map((e) => ({ ...e, room_seq: e.room_seq + 4, event_id: `m${e.room_seq}` })),
  ];
  const pin = (e: NimletEvent) => (e.type === "state" ? [(e.content as { k: string }).k] : []);
  const kept = retainTimeline({ a: events }, { perRoom: 10, pin });
  assert.deepEqual(
    kept.map((e) => e.room_seq),
    [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  );
});

test("validSnapshot rejects foreign or corrupt data", () => {
  assert.equal(validSnapshot(null), false);
  assert.equal(validSnapshot({ v: 2, events: [] }), false);
  assert.equal(validSnapshot({ v: 1, events: [], cursor: 3 }), false);
  assert.equal(validSnapshot({ v: 1, events: [], rooms: {} }), false);
  assert.equal(validSnapshot({ v: 1, events: [], savedAt: 0 }), true);
});

test("cachedRooms keeps listed rooms only, without their last event", () => {
  const rooms = cachedRooms({
    a: { room_id: "a", name: "Sala", state: "join", role: "owner", join_rule: "invite", lastEvent: event("a", 1) },
    b: { room_id: "b", name: "b", lastEvent: event("b", 1) },
  });
  assert.deepEqual(rooms, [{ room_id: "a", name: "Sala", state: "join", role: "owner", join_rule: "invite" }]);
});

test("snapshots carry the room list", async () => {
  const m = memory();
  const list = [{ room_id: "a", name: "Sala", state: "join" as const, role: "", join_rule: "" }];
  const p = createTimelinePersister({ storage: m.storage, read: () => ({}), rooms: () => list, debounceMs: 5 });
  p.schedule();
  await p.flush();
  assert.deepEqual(m.saved[0].rooms, list);
});

function memory() {
  const saved: TimelineSnapshot[] = [];
  let cleared = 0;
  return {
    saved,
    get cleared() {
      return cleared;
    },
    storage: {
      load: async () => saved.at(-1) ?? null,
      save: async (s: TimelineSnapshot) => {
        saved.push(s);
      },
      clear: async () => {
        cleared++;
      },
    },
  };
}

test("each saved cursor travels with the events of its batch", async () => {
  const m = memory();
  const store: Record<string, NimletEvent[]> = {};
  const p = createTimelinePersister({ storage: m.storage, read: () => store, debounceMs: 5 });
  store.a = [event("a", 1)];
  p.noteCursor("10");
  await p.flush();
  store.a = [...store.a, event("a", 2)];
  p.noteCursor("11");
  await p.flush();
  assert.deepEqual(
    m.saved.map((s) => [s.cursor, s.events.length]),
    [["10", 1], ["11", 2]],
  );
});

test("debounces writes and stops after discard()", async () => {
  const m = memory();
  const p = createTimelinePersister({ storage: m.storage, read: () => ({}), debounceMs: 5 });
  p.schedule();
  p.schedule();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(m.saved.length, 1);
  p.schedule();
  await p.discard();
  p.schedule();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(m.saved.length, 1, "a discarded session writes nothing more");
});

test("a SyncEngine built with a cursor resumes /sync from it", async () => {
  const urls: string[] = [];
  globalThis.fetch = ((url: string, init: RequestInit = {}) => {
    urls.push(url);
    const signal = init.signal as AbortSignal;
    return new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
    );
  }) as typeof fetch;
  const engine = new SyncEngine({
    client: new NimletClient({ baseUrl: "https://nimlet.test", storage: new InMemoryTokenStorage() }),
    since: "42",
    onEvents: () => {},
  });
  engine.start();
  await new Promise((r) => setTimeout(r, 10));
  engine.stop();
  assert.match(urls[0], /[?&]since=42(&|$)/);
});
