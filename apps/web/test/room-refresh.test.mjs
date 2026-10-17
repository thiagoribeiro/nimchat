import { test } from "node:test";
import assert from "node:assert/strict";
import { RoomRefreshController, acceptRoomInvitation } from "../lib/room-refresh.ts";
import { setLocale } from "@nimchat/i18n";

// These assertions check the pt-BR catalog.
setLocale("pt-BR");

const room = { room_id: "room", name: "Sala", state: "invite", role: "member", join_rule: "invite_only" };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function setup(load) {
  let current = true; const applied = [], states = [];
  const controller = new RoomRefreshController({ load, hydrate: (rooms) => applied.push(rooms), isCurrentSession: () => current, onState: (s) => states.push(s) });
  return { controller, applied, states, logout: () => { current = false; } };
}
test("concurrent refresh callers share one request", async () => {
  const request = deferred(); let calls = 0;
  const s = setup(() => { calls++; return request.promise; });
  const a = s.controller.refresh(), b = s.controller.refresh();
  assert.equal(a, b); await flush(); assert.equal(calls, 1);
  request.resolve({ rooms: [room] }); await a;
  assert.deepEqual(s.applied, [[room]]); assert.equal(s.states.at(-1).isRefreshingRooms, false);
});
test("polls every 15 seconds, pauses, resumes once and stops", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let calls = 0; const s = setup(async () => { calls++; return { rooms: [] }; });
  s.controller.setActive(true); await flush(); await s.controller.refresh();
  assert.equal(calls, 1);
  t.mock.timers.tick(15000); await flush(); await s.controller.refresh(); assert.equal(calls, 2);
  s.controller.setActive(false); t.mock.timers.tick(60000); await flush(); assert.equal(calls, 2);
  s.controller.setActive(true); await flush(); await s.controller.refresh(); assert.equal(calls, 3);
  s.controller.stop(); t.mock.timers.tick(60000); await flush(); assert.equal(calls, 3);
});
test("responses arriving after logout cannot hydrate another account", async () => {
  const request = deferred(), s = setup(() => request.promise);
  const flight = s.controller.refresh(); await flush(); s.logout();
  request.resolve({ rooms: [room] }); await flight; assert.deepEqual(s.applied, []);
});
test("a disposed session ignores an outstanding response", async () => {
  const request = deferred(), s = setup(() => request.promise);
  const flight = s.controller.refresh(); await flush(); s.controller.stop();
  request.resolve({ rooms: [room] }); await flight; assert.deepEqual(s.applied, []);
});
test("failure preserves rooms, exposes an error and allows recovery", async () => {
  let fail = false; const s = setup(async () => { if (fail) throw new Error("offline"); return { rooms: [room] }; });
  await s.controller.refresh(); fail = true; await assert.rejects(s.controller.refresh());
  assert.deepEqual(s.applied, [[room]]); assert.match(s.states.at(-1).roomRefreshError, /atualizar/);
  fail = false; await s.controller.refresh(); assert.equal(s.states.at(-1).roomRefreshError, null);
});
test("a list started before confirmed acceptance cannot restore invite state", async () => {
  const request = deferred(), s = setup(() => request.promise);
  const flight = s.controller.refresh(); await flush(); s.controller.confirmJoined(room);
  request.resolve({ rooms: [room] }); await flight;
  assert.equal(s.applied.at(-1)[0].state, "join");
});
test("successful acceptance opens immediately despite a failed list refresh", async () => {
  const actions = [];
  await acceptRoomInvitation(room, {
    join: async () => { actions.push("joined"); }, isCurrentSession: () => true,
    confirmJoined: (r) => { assert.equal(r.room_id, room.room_id); actions.push("confirmed"); },
    open: () => actions.push("opened"), refresh: async () => { actions.push("refresh"); throw new Error("offline"); },
  });
  await flush(); assert.deepEqual(actions, ["joined", "confirmed", "opened", "refresh"]);
});
test("failed acceptance never confirms or opens the room", async () => {
  await assert.rejects(acceptRoomInvitation(room, {
    join: async () => { throw new Error("forbidden"); }, isCurrentSession: () => true,
    confirmJoined: () => assert.fail(), open: () => assert.fail(), refresh: () => assert.fail(),
  }));
});
test("acceptance finishing after account switch cannot navigate", async () => {
  await acceptRoomInvitation(room, { join: async () => {}, isCurrentSession: () => false,
    confirmJoined: () => assert.fail(), open: () => assert.fail(), refresh: () => assert.fail() });
});

test("a stale complete list cannot erase a room created while it was loading", async () => {
 const request=deferred(), s=setup(()=>request.promise);
 const flight=s.controller.refresh(); await flush(); s.controller.confirmJoined(room);
 request.resolve({rooms:[]}); await flight;
 assert.equal(s.applied.at(-1)[0].room_id,room.room_id);
 assert.equal(s.applied.at(-1)[0].state,"join");
});
