import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activeSurfaces, decode, instanceKey, project } from "../src/index.ts";
import type { Block, Event } from "../src/index.ts";
import { setLocale } from "@nimchat/i18n";

// These assertions check the pt-BR catalog.
setLocale("pt-BR");
const trust = {
  publishers: new Set(["service"]),
  agents: new Set(["agent"]),
  userId: "me",
};
const view = (revision: number, status = "pending") => ({
  title: "Cancelar automação",
  owner_id: "me",
  revision,
  status,
});
const block = (plugin = "approval"): Block => ({
  type: "plugin",
  plugin,
  instance_id: "a",
  version: "1.0",
  schema_version: "1.0",
  fallback_markdown: "Aprovação pendente",
  view: view(1),
  surface: { auto_pin: true, default: "pinned" },
});
const event = (
  id: string,
  pos: number,
  type: string,
  content: unknown,
  sender = "service",
  room = "room",
): Event => ({
  event_id: id,
  room_id: room,
  room_seq: pos,
  type,
  content,
  sender_id: sender,
});
const message = event(
  "message",
  10,
  "m.ui.message",
  { schema: "brian.message", version: "1.0", body: [block()] },
  "agent",
);
test("unknown plugin and invalid block preserve readable fallback", () => {
  const result = decode({
    schema: "brian.message",
    version: "1.0",
    body: [
      block("future"),
      { type: "notice", text: "invalid" },
      { type: "markdown", text: "normal" },
    ],
  });
  assert.equal(result[0].type, "markdown");
  assert.equal(result[0].text, "Aprovação pendente");
  assert.equal(result[2].text, "normal");
});
test("out-of-order updates never regress; update may arrive before card", () => {
  const events = [
    event("r3", 8, "m.plugin.state.updated", {
      plugin: "approval",
      instance_id: "a",
      view: view(3, "approved"),
    }),
    message,
    event("r2", 12, "m.plugin.state.updated", {
      plugin: "approval",
      instance_id: "a",
      view: view(2),
    }),
  ];
  const s = project(events, trust).get(instanceKey("room", "approval", "a"))!;
  assert.equal(s.block.view.revision, 3);
  assert.equal(s.block.view.status, "approved");
  assert.equal(s.sourceEventId, "message");
  assert.equal(activeSurfaces(project(events, trust)).length, 0);
});
test("delegated updates use the installed renderer without audit-specific UI", () => {
  const initial = {
    ...block("checklist"),
    view: { ...view(1, "open"), items: [{ id: "i", label: "Passaporte", checked: false }] },
  };
  const card = event("card", 10, "m.ui.message", {
    schema: "brian.message", version: "1.0", body: [initial],
  }, "agent");
  const update = event("updated", 12, "m.plugin.state.updated", {
    plugin: "checklist", instance_id: "a", command_event_id: "command",
    view: { ...initial.view, revision: 2, items: [{ id: "i", label: "Passaporte", checked: true }] },
    delegation: { agent_id: "agent", requester_id: "me", request_event_id: "human", request_room_seq: 11 },
  });
  const surface = project([card, update], trust).get(instanceKey("room", "checklist", "a"))!;
  assert.equal(surface.block.view.revision, 2);
  assert.equal(surface.block.view.items[0].checked, true);
  assert.equal(activeSurfaces(project([card, update], trust)).length, 1);
  assert.equal(project([card, { ...update, sender_id: "attacker" }], trust).get(instanceKey("room", "checklist", "a"))!.block.view.revision, 1);
});
test("forged publisher and cross-room update cannot approve", () => {
  const forged = event(
    "forged",
    20,
    "m.plugin.state.updated",
    { plugin: "approval", instance_id: "a", view: view(9, "approved") },
    "attacker",
  );
  const other = event(
    "other",
    21,
    "m.plugin.state.updated",
    { plugin: "approval", instance_id: "a", view: view(10, "approved") },
    "service",
    "other",
  );
  assert.equal(
    project([message, forged, other], trust).get(
      instanceKey("room", "approval", "a"),
    )!.block.view.status,
    "pending",
  );
  assert.equal(project([{ ...message, sender_id: "attacker" }], trust).size, 0);
});
test("pin and dismiss are personal, terminal state unpins automatically", () => {
  const approved = event("approved", 15, "m.plugin.state.updated", {
    plugin: "approval",
    instance_id: "a",
    view: view(2, "approved"),
  });
  const pref = {
    plugin: "approval",
    instance_id: "a",
    user_pin: true,
    dismissed: false,
  };
  assert.equal(
    activeSurfaces(
      project(
        [
          message,
          approved,
          event(
            "foreign",
            20,
            "m.ui.surface.preference.updated",
            pref,
            "other",
          ),
        ],
        trust,
      ),
    ).length,
    0,
  );
  assert.equal(
    activeSurfaces(
      project(
        [
          message,
          approved,
          event("mine", 20, "m.ui.surface.preference.updated", pref, "me"),
        ],
        trust,
      ),
    ).length,
    1,
  );
  assert.equal(
    activeSurfaces(
      project(
        [
          message,
          event(
            "dismiss",
            20,
            "m.ui.surface.preference.updated",
            { ...pref, dismissed: true },
            "me",
          ),
        ],
        trust,
      ),
    ).length,
    0,
  );
});
test("duplicate replay rebuilds same projection", () => {
  assert.deepEqual(
    project([message, message], trust),
    project([message], trust),
  );
});

const workflowEvents: Event[] = JSON.parse(readFileSync(
  new URL("./fixtures/workflow-events.json", import.meta.url), "utf8",
));
test("RiteSmith workflow envelope projects the latest running surface", () => {
  const surfaces = project(workflowEvents, trust);
  const [surface] = activeSurfaces(surfaces);
  assert.equal(surfaces.size, 1);
  assert.equal(surface.block.plugin, "workflow");
  assert.equal(surface.block.view.status, "running");
  assert.equal(surface.block.view.revision, 2);
  assert.equal(surface.sourceEventId, workflowEvents[0].event_id);
});
test("publisher snapshots recover a surface when the original card is outside history", () => {
  const snapshots = workflowEvents.filter(e => e.type !== "m.ui.message");
  for (const events of [snapshots, snapshots.slice(-1)]) {
    const [surface] = activeSurfaces(project(events, trust));
    assert.equal(surface.block.view.status, "running");
    assert.equal(surface.title, "Monitorar chuva");
  }
  const recovered = project([snapshots.at(-1)!, ...workflowEvents], trust);
  assert.equal(activeSurfaces(recovered)[0].sourceEventId, workflowEvents[0].event_id);
});
test("snapshot recovery still rejects untrusted senders and malformed plugin views", () => {
  const snapshot = workflowEvents.at(-1)!;
  assert.equal(project([{ ...snapshot, sender_id: "agent" }], trust).size, 0);
  assert.equal(project([{ ...snapshot, sender_id: "attacker" }], trust).size, 0);
  assert.equal(project([{ ...snapshot, content: {
    ...(snapshot.content as Block), view: { revision: 20, status: "made_up" },
  }}], trust).size, 0);
});
