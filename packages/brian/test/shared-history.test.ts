import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSharedSurfaceHistory } from "@nimchat/sdk/shared-history";
import { project } from "../src/index.ts";
const trust = { userId: "owner", agents: new Set<string>(), publishers: new Set(["publisher"]) };
const event = (seq: number, surface = false, sender = "publisher"): any => ({
  event_id: "event-" + seq, room_id: "shared", room_seq: seq, sender_id: sender,
  type: surface ? "m.plugin.instance.created" : "m.room.message", origin_server_ts: seq,
  content: surface ? { plugin: "checklist", instance_id: "list", view: {
    owner_id: "owner", revision: 1, title: "Compras QA", status: "open",
    items: [{ id: "a", label: "Item QA", checked: false }],
    shared: { id: "11111111-1111-4111-8111-111111111111", room_id: "shared" },
  } } : { body: "Mensagem QA" },
});
function setup(initial = [event(200)]) {
  const events = [...initial], calls: any[] = [];
  const pages = [{ chunk: [event(150)], start: 150, end: 150 }, { chunk: [event(1, true)], start: 1, end: 1 }];
  let access = true;
  const options = {
    roomId: "shared", canRead: () => access,
    ready: () => [...project(events, trust).values()].some((s) => s.block.view.shared?.room_id === "shared"),
    apply: (page: any[]) => events.push(...page),
    load: async (_room: string, opts: any) => { calls.push(opts); return pages.shift() ?? { chunk: [], start: 0, end: 0 }; },
  };
  return { events, calls, options, revoke: () => { access = false; } };
}
test("cached messages do not skip recovery of an older trusted shared surface", async () => {
  const s = setup();
  assert.equal(await loadSharedSurfaceHistory(s.options), "ready");
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[1].from, 150);
  assert(s.options.ready());
});
test("a cached trusted surface avoids redundant history requests", async () => {
  const s = setup([event(1, true)]);
  assert.equal(await loadSharedSurfaceHistory(s.options), "ready");
  assert.equal(s.calls.length, 0);
});
test("forged surface state is not accepted as a loaded publication", async () => {
  const s = setup([event(199, true, "attacker")]);
  assert.equal(await loadSharedSurfaceHistory(s.options), "ready");
  assert.equal(s.calls.length, 2);
});
test("revocation during a response cannot repopulate the room cache", async () => {
  const s = setup([]);
  s.options.load = async () => { s.revoke(); return { chunk: [event(1, true)], start: 1, end: 1 }; };
  assert.equal(await loadSharedSurfaceHistory(s.options), "revoked");
  assert.equal(s.events.length, 0);
});
test("missing publications finish with an actionable state instead of endless loading", async () => {
  const s = setup([]);
  s.options.load = async () => ({ chunk: [], start: 0, end: 0 });
  assert.equal(await loadSharedSurfaceHistory(s.options), "missing");
});
test("history errors propagate so a retry can recover without losing cached messages", async () => {
  const s = setup(); let fail = true; const load = s.options.load;
  s.options.load = async (room, opts) => { if (fail) throw Error("offline"); return load(room, opts); };
  await assert.rejects(loadSharedSurfaceHistory(s.options), /offline/);
  assert.equal(s.events.length, 1); fail = false;
  assert.equal(await loadSharedSurfaceHistory(s.options), "ready");
});
test("history beyond twenty pages can recover without looping on invalid pagination", async () => {
  const s = setup([]); let page = 0;
  s.options.load = async () => { page++; return { chunk: [event(3000-page, page === 22)], start: 3000-page, end: 3000-page }; };
  assert.equal(await loadSharedSurfaceHistory(s.options), "ready");
  assert.equal(page, 22);
  const bad = setup([]); let calls = 0;
  bad.options.load = async () => { calls++; return { chunk: [event(500)], start: 500, end: 500 }; };
  assert.equal(await loadSharedSurfaceHistory(bad.options), "missing");
  assert.equal(calls, 2);
});
