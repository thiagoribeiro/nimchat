import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeSurfaces,
  hasNews,
  instanceKey,
  project,
  statusInfo,
  surfaceSections,
  surfaceTitle,
} from "../src/index.ts";
import type { Block, Event } from "../src/index.ts";
import { setLocale } from "@nimchat/i18n";

// These assertions check the pt-BR catalog.
setLocale("pt-BR");

const trust = { publishers: new Set(["service"]), agents: new Set(["agent"]), userId: "me" };
const card = (plugin: string, id: string, status: string, title?: string): Block => ({
  type: "plugin",
  plugin,
  instance_id: id,
  version: "1.0",
  schema_version: "1.0",
  fallback_markdown: "fallback",
  view: {
    ...(title ? { title } : {}),
    owner_id: "me",
    revision: 1,
    status,
    ...(plugin === "workflow" ? { steps: [] } : {}),
  },
  surface: { auto_pin: true, default: "pinned" },
});
let pos = 0;
const msg = (blocks: Block[], room = "room"): Event => ({
  event_id: `e${++pos}`,
  room_id: room,
  room_seq: pos,
  sender_id: "agent",
  type: "m.ui.message",
  content: { schema: "brian.message", version: "1.0", body: blocks },
});
const pref = (plugin: string, id: string, user_pin: boolean, dismissed: boolean): Event => ({
  event_id: `e${++pos}`,
  room_id: "room",
  room_seq: pos,
  sender_id: "me",
  type: "m.ui.surface.preference.updated",
  content: { plugin, instance_id: id, user_pin, dismissed },
});

test("sections order pinned, active, recent and archive terminal or hidden", () => {
  const events = [
    msg([card("approval", "done", "approved", "Antigo")]),
    msg([card("approval", "pending", "pending", "Aprovar deploy")]),
    msg([card("approval", "pinned", "approved", "Fixado")]),
    msg([card("approval", "hidden", "pending", "Oculto")]),
    pref("approval", "pinned", true, false),
    pref("approval", "hidden", false, true),
  ];
  const s = surfaceSections(project(events, trust), "room");
  assert.deepEqual(s.pinned.map((x) => x.block.instance_id), ["pinned"]);
  assert.deepEqual(s.active.map((x) => x.block.instance_id), ["pending"]);
  assert.deepEqual(s.recent, []);
  assert.deepEqual(s.archived.map((x) => x.block.instance_id).sort(), ["done", "hidden"]);
});

test("sections never mix rooms with the same plugin and instance id", () => {
  const events = [
    msg([card("approval", "same", "pending", "Sala A")], "a"),
    msg([card("approval", "same", "pending", "Sala B")], "b"),
  ];
  const surfaces = project(events, trust);
  const a = surfaceSections(surfaces, "a");
  assert.equal(a.active.length, 1);
  assert.equal(a.active[0].title, "Sala A");
  assert.equal(surfaceSections(surfaces, "c").active.length, 0);
});

test("title falls back to a friendly plugin label", () => {
  const block = card("approval", "x", "pending");
  assert.equal(surfaceTitle({ title: "approval", block }), "Aprovação");
  assert.equal(surfaceTitle({ title: " ", block }), "Aprovação");
  assert.equal(surfaceTitle({ title: "Backup da VM", block }), "Backup da VM");
});

test("status info maps tones and expires pending approvals", () => {
  assert.deepEqual(statusInfo({ status: "running" }), { label: "Em andamento", tone: "active" });
  assert.equal(statusInfo({ status: "pending", expires_at: "2000-01-01T00:00:00Z" }).label, "Expirado");
  assert.equal(statusInfo({ status: "novo_estado" }).tone, "neutral");
});

test("news compares surface activity with local read position", () => {
  const surfaces = project([msg([card("approval", "n", "pending", "Novo")])], trust);
  const s = surfaces.get(instanceKey("room", "approval", "n"))!;
  assert.equal(hasNews(s, {}), true);
  assert.equal(hasNews(s, { [s.key]: s.activity }), false);
});

test("large room projection stays fast enough to run per event batch", () => {
  const events: Event[] = [];
  for (let i = 0; i < 60; i++) events.push(msg([card("approval", `big${i}`, "pending", `Aprovação ${i}`)]));
  for (let i = 0; i < 3000; i++)
    events.push({
      event_id: `s${++pos}`,
      room_id: "room",
      room_seq: pos,
      sender_id: i % 3 ? "human" : "service",
      type: i % 3 ? "m.room.message" : "m.plugin.state.updated",
      content:
        i % 3
          ? { msgtype: "m.text", body: `mensagem ${i}` }
          : {
              plugin: "approval",
              instance_id: `big${i % 60}`,
              view: { title: `Aprovação ${i % 60}`, owner_id: "me", revision: 2 + i, status: "pending" },
            },
    });
  const start = performance.now();
  const surfaces = project(events, trust);
  const elapsed = performance.now() - start;
  assert.equal(surfaceSections(surfaces, "room").active.length, 60);
  assert.ok(elapsed < 250, `projection took ${elapsed.toFixed(1)}ms`);
});

test("active surfaces of different rooms rank by time, not room_seq", () => {
  // room_seq restarts per room: a busy room's old card has a higher seq than a quiet room's new one.
  const old = { ...msg([card("approval", "old", "pending", "Antigo")], "busy"), room_seq: 900, origin_server_ts: 1000 };
  const recent = { ...msg([card("approval", "new", "pending", "Novo")], "quiet"), room_seq: 2, origin_server_ts: 2000 };
  const ranked = activeSurfaces(project([old, recent], trust));
  assert.deepEqual(ranked.map((x) => x.block.instance_id), ["new", "old"]);
});
