import { test } from "node:test";
import assert from "node:assert/strict";
import { createPluginCommandStore } from "../lib/plugin-command-state.ts";
import { instanceKey } from "@nimchat/brian";
import { setLocale } from "@nimchat/i18n";

// These assertions check the pt-BR catalog.
setLocale("pt-BR");

const trust = {
  userId: "me",
  publishers: new Set(["publisher"]),
  agents: new Set(["agent"])
};
const block = {
  type: "plugin",
  plugin: "approval",
  instance_id: "a",
  version: "1.0",
  schema_version: "1.0",
  view: {
    title: "Aprovar",
    status: "pending",
    owner_id: "me",
    revision: 1
  }
};
const key = instanceKey("room", "approval", "a");
const update = (overrides = {}) => ({
  event_id: "update",
  room_id: "room",
  room_seq: 2,
  sender_id: "publisher",
  type: "m.plugin.state.updated",
  content: {
    plugin: "approval",
    instance_id: "a",
    command_event_id: "command",
    view: { ...block.view, revision: 2, status: "approved" }
  },
  ...overrides
});
const memory = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value)
  };
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
function setup(
  send = async () => ({ event_id: "command" }),
  storage = memory()
) {
  let count = 0;
  const store = createPluginCommandStore(() => "txn-" + ++count);
  store.getState().initialize("me", storage, trust, send);
  return { store, storage };
}
test("HTTP acceptance stays pending and suppresses duplicate clicks", async () => {
  let calls = 0;
  const { store } = setup(async () => {
    calls++;
    return { event_id: "command" };
  });
  await store.getState().send("room", block, "approve");
  assert.equal(store.getState().pending[key].status, "waiting");
  await store.getState().send("room", block, "reject");
  assert.equal(calls, 1);
  store.getState().observe({ room: [update()] });
  assert.equal(store.getState().pending[key], undefined);
  assert.equal(store.getState().results[key].revision, 2);
});
test("untrusted, unrelated, malformed and old snapshots cannot acknowledge", async () => {
  const { store } = setup();
  await store.getState().send("room", block, "approve");
  const good = update();
  const invalid = [
    update({ sender_id: "attacker" }),
    update({ room_id: "other" }),
    update({ content: { ...good.content, instance_id: "other" } }),
    update({ content: { ...good.content, plugin: "poll" } }),
    update({
      content: { ...good.content, command_event_id: "other-command" }
    }),
    update({
      content: { ...good.content, view: { ...block.view, revision: 1 } }
    }),
    update({ content: { ...good.content, view: { revision: 99 } } })
  ];
  for (const event of invalid) {
    store.getState().observe({ room: [event] });
    assert(store.getState().pending[key]);
  }
  store.getState().observe({ room: [good] });
  assert.equal(store.getState().pending[key], undefined);
});
test("sync acknowledgement arriving before the HTTP response is recovered", async () => {
  const request = deferred();
  const { store } = setup(() => request.promise);
  const sending = store.getState().send("room", block, "approve");
  store.getState().observe({ room: [update()] });
  assert.equal(store.getState().pending[key].status, "sending");
  request.resolve({ event_id: "command" });
  await sending;
  assert.equal(store.getState().pending[key], undefined);
});
test("publisher rejection is visible until acknowledged by the user", async () => {
  const { store } = setup();
  await store.getState().send("room", block, "approve");
  const rejected = update({
    type: "m.plugin.command.rejected",
    content: {
      plugin: "approval",
      instance_id: "a",
      command_event_id: "command",
      reason: "expired"
    }
  });
  store
    .getState()
    .observe({ room: [{ ...rejected, sender_id: "attacker" }] });
  assert.equal(store.getState().pending[key].status, "waiting");
  store.getState().observe({ room: [rejected] });
  assert.equal(store.getState().pending[key].error, "expired");
  store.getState().dismiss(key);
  assert.equal(store.getState().pending[key], undefined);
});
test("refresh may acknowledge an unchanged authoritative revision", async () => {
  const { store } = setup();
  await store.getState().send("room", block, "refresh");
  store.getState().observe({
    room: [update({ content: { ...update().content, view: block.view } })]
  });
  assert.equal(store.getState().pending[key], undefined);
});
test("lost HTTP response retries the original transaction and immutable payload", async () => {
  const calls = [];
  const { store } = setup(async (room, txn, content) => {
    calls.push({ txn, content });
    if (calls.length === 1) throw new Error("lost response");
    return { event_id: "command" };
  });
  const payload = { values: { text: "original" } };
  await store.getState().send("room", block, "approve", payload);
  payload.values.text = "changed";
  assert.equal(store.getState().pending[key].status, "failed");
  await store
    .getState()
    .send("room", block, "reject", { changed: true }, true);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[1].content.payload.values.text, "original");
});
test("pending commands survive reload and remain isolated by user and room", async () => {
  const { store, storage } = setup();
  await store.getState().send("room", block, "approve");
  const restored = setup(undefined, storage).store;
  assert.equal(restored.getState().pending[key].eventId, "command");
  restored
    .getState()
    .initialize(
      "other",
      storage,
      { ...trust, userId: "other" },
      async () => ({ event_id: "other" })
    );
  assert.deepEqual(restored.getState().pending, {});
  restored.getState().initialize("me", storage, trust, async () => ({
    event_id: "command"
  }));
  restored.getState().observe({ other: [update({ room_id: "other" })] });
  assert(restored.getState().pending[key]);
  restored.getState().observe({ room: [update()] });
  assert.equal(restored.getState().pending[key], undefined);
});
test("HTTP completion from a previous session cannot mutate the current user", async () => {
  const request = deferred();
  const { store, storage } = setup(() => request.promise);
  const sending = store.getState().send("room", block, "approve");
  store
    .getState()
    .initialize(
      "other",
      storage,
      { ...trust, userId: "other" },
      async () => ({ event_id: "other" })
    );
  request.resolve({ event_id: "command" });
  await sending;
  assert.equal(store.getState().userId, "other");
  assert.deepEqual(store.getState().pending, {});
});
test("a transport without a response times out without claiming success", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { store } = setup(() => new Promise(() => {}));
  const sending = store.getState().send("room", block, "approve");
  t.mock.timers.tick(30000);
  await sending;
  assert.equal(store.getState().pending[key].status, "failed");
  assert.deepEqual(store.getState().results, {});
});
test("corrupt storage cannot acknowledge commands; failed persistence prevents delivery", async () => {
  const { store } = setup(undefined, {
    getItem: () => "not-json",
    setItem: () => {}
  });
  await store.getState().send("room", block, "approve");
  assert.equal(store.getState().pending[key].status, "waiting");
  let calls = 0;
  const broken = setup(
    async () => {
      calls++;
      return { event_id: "never" };
    },
    {
      getItem: () => null,
      setItem: () => {
        throw Error("full disk");
      }
    }
  ).store;
  await assert.rejects(broken.getState().send("room", block, "approve"));
  assert.equal(calls, 0);
  assert.deepEqual(broken.getState().pending, {});
});


test("checklist management commands serialize while item gestures still queue", async () => {
  const { store } = setup();
  const list = { ...block, plugin: "checklist", view: { ...block.view, status: "open", items: [] } };
  await store.getState().send("room", list, "preview_share", { invitees: ["guest"] });
  await assert.rejects(store.getState().send("room", list, "preview_share", {}), /Aguarde/);
  await assert.rejects(store.getState().send("room", list, "share", {}), /Aguarde/);
  assert.equal(store.getState().commands.length, 1);
  store.getState().stop();
});

test("send returns the persisted transaction and only its authoritative receipt resolves it", async () => {
  const {store}=setup();
  const txn=await store.getState().send("room",block,"approve");
  assert.equal(txn,"txn-1");
  assert.equal(store.getState().results[key],undefined);
  store.getState().observe({room:[update()]});
  assert.equal(store.getState().results[key].txn,txn);
  store.getState().stop();
});
