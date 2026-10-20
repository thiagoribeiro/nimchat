import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { retainTimeline } from "@nimchat/sdk/timeline-cache";
import { activeSurfaces, project, surfacePins } from "../src/index.ts";
import type { Event } from "../src/index.ts";

const trust = { publishers: new Set(["service"]), agents: new Set(["agent"]), userId: "me" };
const workflow: Event[] = JSON.parse(readFileSync(
  new URL("./fixtures/workflow-events.json", import.meta.url), "utf8",
));
const chat = (seq: number): Event => ({
  event_id: "chat-" + seq, room_id: "room", room_seq: seq, sender_id: "me",
  type: "m.room.message", origin_server_ts: seq, content: { msgtype: "m.text", body: "oi" },
});
const pref = (seq: number, user_pin: boolean): Event => ({
  event_id: "pref-" + seq, room_id: "room", room_seq: seq, sender_id: "me",
  type: "m.ui.surface.preference.updated", origin_server_ts: seq,
  content: { plugin: "workflow", instance_id: "workflow-rain", user_pin, dismissed: false },
});
const view = (events: Event[]) =>
  activeSurfaces(project(events, trust)).map((s) => ({
    key: s.key, status: s.block.view.status, revision: s.block.view.revision,
    userPin: s.userPin, dismissed: s.dismissed,
  }));

test("a retained cache projects the same surfaces as the full history", () => {
  const last = Math.max(...workflow.map((e) => e.room_seq));
  const full = [...workflow, pref(last + 1, true),
    ...Array.from({ length: 150 }, (_, i) => chat(last + 2 + i))];
  const kept = retainTimeline({ room: full as any }, { perRoom: 100, pin: surfacePins(trust) as any });
  assert.ok(kept.length < full.length);
  assert.ok(kept.every((e) => e.type !== "m.ui.message" || e.room_seq > last),
    "old cards are not kept alone above a gap in the timeline");
  assert.deepEqual(view(kept as any), view(full));
  assert.equal(view(full)[0].userPin, true);
});
