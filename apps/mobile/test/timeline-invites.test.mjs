import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { project, instanceKey } from "@nimchat/brian";
import { agentTimeline } from "@nimchat/brian/agent-timeline";
import { InviteDismissals, invitationStorageKey } from "@nimchat/sdk/invite-dismissals";
import { setLocale } from "@nimchat/i18n";

// These assertions check the pt-BR catalog.
setLocale("pt-BR");

const trust = { userId: "me", publishers: new Set(["publisher"]), agents: new Set(["agent"]) };
const view = (revision = 1, status = "running") => ({
  title: "Atividade", owner_id: "me", request_id: "request", revision, sequence: revision, status,
  current_status: status === "completed" ? "Concluído" : "Pensando",
  started_at: "2026-10-14T12:00:00Z", updated_at: "2026-10-14T12:00:00Z", heartbeat_at: "2026-10-14T12:00:00Z",
  finished_at: status === "completed" ? "2026-10-14T12:00:30Z" : null, history_total: 0, active_activities: [], history: [],
});
const event = (id, seq, content, type = "m.plugin.state.updated", sender = "publisher", room = "room") => ({
  event_id: id, room_seq: seq, room_id: room, type, content, sender_id: sender,
  sender_display_name: sender === "agent" ? "Assistant" : "Publisher", origin_server_ts: seq * 1000,
});
const block = { type: "plugin", plugin: "agent_status", instance_id: "status", version: "1.0", schema_version: "1.0", view: view(), fallback_markdown: "Pensando" };
test("publisher-only agent snapshots become an inline timeline row, including terminal history", () => {
  const updates = [event("start", 2, { plugin: "agent_status", instance_id: "status", view: view() }),
    event("done", 3, { plugin: "agent_status", instance_id: "status", view: view(2, "completed") })];
  const rows = agentTimeline(updates, project(updates, trust), trust);
  assert.equal(rows.length, 1); assert.equal(rows[0].events.length, 0);
  assert.equal(rows[0].speaker.id, "agent"); assert.equal(rows[0].activities[0].block.view.status, "completed");
});
test("loading the original card replaces the recovered row without duplication or losing the newest revision", () => {
  const events = [event("card", 1, { schema: "brian.message", version: "1.0", body: [block] }, "m.ui.message", "agent"),
    event("done", 3, { plugin: "agent_status", instance_id: "status", view: view(3, "completed") }),
    event("old", 4, { plugin: "agent_status", instance_id: "status", view: view(2) })];
  const surfaces = project(events, trust), rows = agentTimeline(events, surfaces, trust);
  assert.equal(rows.length, 1); assert.ok(rows[0].eventIds.includes("card"));
  assert.equal(surfaces.get(instanceKey("room", "agent_status", "status")).block.view.status, "completed");
});
test("untrusted, invalid and differently scoped snapshots cannot replace an agent timeline row", () => {
  const events = [event("fake", 1, { plugin: "agent_status", instance_id: "status", view: view() }, undefined, "attacker"),
    event("invalid", 2, { plugin: "agent_status", instance_id: "status", view: {} })];
  assert.equal(agentTimeline(events, project(events, trust), trust).length, 0);
  const valid = event("other", 3, { plugin: "agent_status", instance_id: "status", view: view() }, undefined, undefined, "other");
  const rows = agentTimeline([...events, valid], project([...events, valid], trust), trust);
  assert.equal(rows.length, 1); assert.equal(rows[0].activities[0].roomId, "other");
});
test("a forged creation card cannot hide a publisher-only agent status", () => {
  const events = [event("fake-card", 1, { schema: "brian.message", version: "1.0", body: [block] }, "m.ui.message", "attacker"),
    event("real-status", 2, { plugin: "agent_status", instance_id: "status", view: view() })];
  const rows = agentTimeline(events, project(events, trust), trust);
  assert.equal(rows.length, 2);
  assert.ok(rows.some(r => r.eventIds.includes("real-status")));
});
const state = (request = "request", instance = "status", seq = 2) => event("state-" + instance, seq,
  { plugin: "agent_status", instance_id: instance, view: { ...view(), request_id: request } });
const reply = (request, id = "answer", seq = 3, sender = "agent", room = "room") => event(id, seq,
  { body: "Resposta", metadata: { request_event_id: request } }, "m.room.message", sender, room);
const timeline = events => agentTimeline(events, project(events, trust), trust);
test("status and the correlated answer share a stable agent block without changing publisher identity", () => {
  const source = state(); const pending = timeline([source])[0];
  const answer = reply("request"); const completed = timeline([source, answer]);
  assert.equal(completed.length, 1); assert.equal(completed[0].key, pending.key);
  assert.equal(completed[0].speaker.name, "Assistant");
  assert.equal(completed[0].activities.length, 1); assert.equal(completed[0].events[0], answer);
  assert.equal(source.sender_id, "publisher"); assert.equal(source.type, "m.plugin.state.updated");
  assert.deepEqual(completed[0].eventIds.sort(), ["answer", "state-status"].sort());
});
test("simultaneous requests and out-of-order replies keep independent activity and response blocks", () => {
  const rows = timeline([state("one", "s1", 2), state("two", "s2", 3), reply("two", "r2", 4), reply("one", "r1", 5)]);
  assert.equal(rows.length, 2);
  for (const row of rows) assert.equal(row.events[0].content.metadata.request_event_id, row.activities[0].block.view.request_id);
});
test("reply first, later status, reload and pagination keep one block and original reaction IDs", () => {
  const answer = reply("request"), media = event("image", 4, { content_uri: "mxc://x", metadata: { request_event_id: "request" } }, "m.room.attachment", "agent");
  const first = timeline([answer])[0], rows = timeline([media, state(), answer]);
  assert.equal(rows.length, 1); assert.equal(rows[0].key, first.key);
  assert.deepEqual(rows[0].events.map(e => e.event_id), ["answer", "image"]);
  assert.equal(rows[0].events[0], answer); assert.equal(rows[0].readSeq, 4);
});
test("untrusted correlation and different rooms cannot impersonate the agent or attach a reply", () => {
  const rows = timeline([state(), reply("request", "fake", 3, "attacker"), reply("request", "foreign", 4, "agent", "other")]);
  assert.equal(rows.length, 3);
  assert.equal(rows.find(r => r.activities.length).events.length, 0);
  assert.equal(rows.find(r => r.key === "fake").speaker, undefined);
});
test("mixed envelopes retain the answer while moving only validated activity into its agent turn", () => {
  const card = event("card", 2, { schema: "brian.message", version: "1.0", metadata: { request_event_id: "request" },
    body: [block, { type: "markdown", text: "Resposta real" }] }, "m.ui.message", "agent");
  const rows = timeline([card]); assert.equal(rows.length, 1);
  assert.equal(rows[0].activities.length, 1); assert.deepEqual(rows[0].events[0].content.body, [{ type: "markdown", text: "Resposta real" }]);
  assert.equal(card.content.body.length, 2);
});
test("multiple configured agents require an actual correlated reply to name the activity speaker", () => {
  const multi = { ...trust, agents: new Set(["agent", "other-agent"]) }, source = state();
  const pending = agentTimeline([source], project([source], multi), multi);
  assert.equal(pending[0].speaker.id, ""); assert.equal(pending[0].speaker.name, "Agente");
  const answer = reply("request"); const rows = agentTimeline([source, answer], project([source, answer], multi), multi);
  assert.equal(rows.length, 1); assert.equal(rows[0].speaker.id, "agent");
});
test("old sequential history is grouped only with a complete, non-overlapping request interval", () => {
  const start = Date.parse(view().started_at), request = { ...event("request", 1, { body: "Pedido" }, "m.room.message", "me"), origin_server_ts: start - 1000 };
  const completed = event("done", 3, { plugin: "agent_status", instance_id: "status", view: view(2, "completed") });
  const answer = { ...event("answer", 4, { body: "Legado" }, "m.room.message", "agent"), origin_server_ts: start + 29000 };
  const rows = timeline([request, completed, answer]); assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.activities.length).events[0], answer);
  assert.equal(timeline([completed, answer]).length, 2);
  const concurrent = state("other-request", "other-status", 2);
  assert.equal(timeline([request, concurrent, completed, answer]).find(r => r.activities.some(s => s.block.instance_id === "status")).events.length, 0);
});
function storage() {
  const data = new Map();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
test("local invitation dismissal survives reload, remains isolated per account and can be restored", () => {
  const local = storage(); let ids;
  const a = new InviteDismissals("a", local, (value) => { ids = value; });
  a.dismiss("room"); assert.equal(ids.has("room"), true);
  new InviteDismissals("b", local, (value) => { ids = value; }); assert.equal(ids.has("room"), false);
  const reloaded = new InviteDismissals("a", local, (value) => { ids = value; });
  assert.equal(ids.has("room"), true);
  reloaded.restore("room"); assert.equal(ids.has("room"), false);
  assert.equal(local.data.get(invitationStorageKey("a")), "[]");
});
test("invitation dismissal never crosses device storage and corrupt data cannot hide rooms", () => {
  const first = storage(), second = storage(); let ids;
  new InviteDismissals("a", first, () => {}).dismiss("room");
  new InviteDismissals("a", second, (value) => { ids = value; }); assert.equal(ids.size, 0);
  for (const value of ['{"room":true}', '["room",null]', "not json"]) {
    second.data.set(invitationStorageKey("a"), value);
    new InviteDismissals("a", second, (value) => { ids = value; }); assert.equal(ids.size, 0);
  }
});
test("failed persistence preserves the displayed invitations and offers a real retry", () => {
  let fail = true, ids;
  const local = storage(), original = local.setItem;
  local.setItem = (...args) => { if (fail) throw new Error("full"); original(...args); };
  const prefs = new InviteDismissals("a", local, (value) => { ids = value; });
  assert.throws(() => prefs.dismiss("room")); assert.equal(ids.size, 0);
  fail = false; prefs.dismiss("room"); assert.equal(ids.has("room"), true);
});
test("release build refuses missing production trust IDs before invoking Gradle", () => {
  for (const name of ["EXPO_PUBLIC_BRIAN_AGENT_IDS", "EXPO_PUBLIC_BRIAN_PUBLISHER_IDS"]) {
    const result = spawnSync(process.execPath, [new URL("../scripts/build-release.mjs", import.meta.url).pathname], {
      env: { ...process.env, EXPO_PUBLIC_NIMLET_URL: "https://nimlet.test", EXPO_PUBLIC_BRIAN_AGENT_IDS: "agent", EXPO_PUBLIC_BRIAN_PUBLISHER_IDS: "publisher", [name]: " , " },
      encoding: "utf8",
    });
    assert.equal(result.status, 1); assert.match(result.stderr, new RegExp(name));
  }
});
test("release build refuses a missing Nimlet URL", () => {
  const result = spawnSync(process.execPath, [new URL("../scripts/build-release.mjs", import.meta.url).pathname], {
    env: { ...process.env, EXPO_PUBLIC_NIMLET_URL: " ", EXPO_PUBLIC_BRIAN_AGENT_IDS: "agent", EXPO_PUBLIC_BRIAN_PUBLISHER_IDS: "publisher" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1); assert.match(result.stderr, /EXPO_PUBLIC_NIMLET_URL/);
});
