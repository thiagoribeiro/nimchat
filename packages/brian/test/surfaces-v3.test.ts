import { setLocale } from "@nimchat/i18n";
import { test } from "node:test";
import assert from "node:assert/strict";
import { CommandQueue } from "@nimchat/sdk/command-queue";
import {
  overlayView,
  project,
  creationLabel,
  isSharedRoom,
  surfaceReference,
  localReference,
  parseBRL,
  billTotals,
  brl,
  supported,
} from "../src/index.ts";

// These assertions check the pt-BR catalog.
setLocale("pt-BR");
const trust = {
  userId: "owner",
  agents: new Set(["agent"]),
  publishers: new Set(["publisher"]),
};
const memory = () => {
  const data = new Map();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  };
};
const tick = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
function queue(
  storage = memory(),
  send: any = async (_r: string, txn: string) => ({ event_id: txn }),
  scope = { server: "test", namespace: "default", user: "owner" },
) {
  let n = 0;
  return new CommandQueue({
    storage,
    scope,
    uuid: () => `txn-${++n}`,
    publishers: trust.publishers,
    send,
    validView: (_p, _i, v: any) => Number.isSafeInteger(v?.revision),
  });
}
const ack = (txn: string, revision = 2, overrides: any = {}) => ({
  event_id: "ack-" + txn,
  room_id: "room",
  room_seq: revision,
  sender_id: "publisher",
  type: "m.plugin.state.updated",
  content: {
    plugin: "checklist",
    instance_id: "list",
    command_event_id: txn,
    view: { revision },
  },
  ...overrides,
});
test("rapid item intentions stay optimistic until their own acknowledgements", async () => {
  const q = queue();
  const a = q.enqueue("room", "checklist", "list", 1, "check_item", {
    item_id: "a",
  });
  const b = q.enqueue("room", "checklist", "list", 1, "uncheck_item", {
    item_id: "a",
  });
  await q.flush();
  assert.equal(q.items[1].status, "queued");
  const base = { status: "open", items: [{ id: "a", checked: false }] };
  assert.equal(overlayView(base, q.items).items[0].checked, false);
  q.observe([ack("unrelated", 99)]);
  assert.equal(q.items.length, 2);
  q.observe([ack(a)]);
  await tick();
  assert.equal(q.items.length, 1);
  assert.equal(q.items[0].eventId, b);
  assert.equal(
    overlayView({ ...base, items: [{ id: "a", checked: true }] }, q.items)
      .items[0].checked,
    false,
  );
  q.observe([ack(a), ack(b, 3)]);
  assert.equal(q.items.length, 0);
});
test("uncertain transport is durable, scope-isolated, and retries the same immutable transaction", async () => {
  const storage = memory(),
    calls: any[] = [];
  const send = async (_r: string, txn: string, p: any) => {
    calls.push([txn, p]);
    throw Error("offline");
  };
  const q = queue(storage, send);
  const payload = { item_id: "a" };
  const txn = q.enqueue("room", "checklist", "list", 1, "check_item", payload);
  payload.item_id = "changed";
  await q.flush();
  q.close();
  const resumed = queue(storage, send);
  assert.equal(resumed.items[0].txn, txn);
  await resumed.retry(txn);
  assert.equal(calls[1][1].payload.item_id, "a");
  assert.equal(
    queue(storage, send, {
      server: "other",
      namespace: "default",
      user: "owner",
    }).items.length,
    0,
  );
  resumed.setRooms(new Set());
  assert.equal(resumed.items.length, 0);
});
test("rejection removes only the rejected overlay and cannot be forged", async () => {
  const q = queue();
  const id = q.enqueue("room", "checklist", "list", 1, "check_item", {
    item_id: "a",
  });
  await q.flush();
  const rejection = {
    ...ack(id),
    type: "m.plugin.command.rejected",
    content: {
      plugin: "checklist",
      instance_id: "list",
      command_event_id: id,
      reason: "revoked",
    },
  };
  q.observe([{ ...rejection, sender_id: "attacker" }]);
  assert.equal(q.items[0].status, "waiting");
  q.observe([rejection]);
  assert.equal(q.items[0].status, "rejected");
  assert.equal(
    overlayView({ items: [{ id: "a", checked: false }] }, q.items).items[0]
      .checked,
    false,
  );
});
test("original creation survives newer snapshots and incomplete history never invents creation", () => {
  const block = {
    type: "plugin",
    plugin: "checklist",
    instance_id: "list",
    version: "1.0",
    schema_version: "1.0",
    fallback_markdown: "Lista",
    view: {
      title: "Lista",
      owner_id: "owner",
      status: "open",
      revision: 1,
      items: [{ id: "a", label: "A", checked: false }],
    },
  };
  const original = {
    event_id: "original",
    room_id: "room",
    room_seq: 1,
    type: "m.ui.message",
    sender_id: "agent",
    origin_server_ts: 1000,
    content: { schema: "brian.message", version: "1.0", body: [block] },
  };
  const update = {
    event_id: "update",
    room_id: "room",
    room_seq: 99,
    type: "m.plugin.state.updated",
    sender_id: "publisher",
    origin_server_ts: 999999,
    content: {
      plugin: "checklist",
      instance_id: "list",
      view: { ...block.view, revision: 2 },
    },
  };
  const s = [...project([update, original], trust).values()][0];
  assert.equal(s.createdAt, 1000);
  assert.equal(s.activityAt, 999999);
  assert.equal([...project([update], trust).values()][0].createdAt, undefined);
  const ref = surfaceReference(s);
  assert(supported(ref));
  assert.equal(
    localReference(ref, "room", project([original], trust))?.key,
    s.key,
  );
  assert.equal(
    localReference(ref, "other", project([original], trust)),
    undefined,
  );
  assert.match(creationLabel(undefined), /indisponível/);
  assert(isSharedRoom("#shared-surface:11111111-1111-4111-8111-111111111111#"));
  assert(!isSharedRoom("#shared-surface:garbage#"));
});
test("money parsing uses integers, separates suggestions, and rejects ambiguous floats", () => {
  assert.equal(parseBRL("R$ 1.234,56"), 123456);
  assert.equal(parseBRL("287,40"), 28740);
  assert.equal(parseBRL("287.40"), undefined);
  assert.equal(parseBRL("-1"), undefined);
  const totals = billTotals(
    [
      {
        status: "pending",
        due_date: "2026-10-01",
        suggested_amount_minor: 24250,
        confirmed_amount_minor: null,
      },
    ],
    "2026-10-15",
  );
  assert.equal(totals.suggested, 24250);
  assert.equal(totals.confirmed, 0);
  assert.equal(totals.paid, 0);
  assert.equal(totals.overdue, 1);
});

test("confirmed membership is a partial upsert; complete refresh revokes caches and rejects late history", async () => {
  const { useChatStore } = await import("@nimchat/sdk/chat-store");
  const s = useChatStore.getState();
  s.reset();
  s.hydrateRooms([
    {
      room_id: "a",
      name: "A",
      state: "join",
      role: "member",
      join_rule: "invite_only",
    },
  ]);
  s.applyEvents([
    {
      event_id: "secret",
      room_id: "a",
      room_seq: 1,
      sender_id: "owner",
      sender_display_name: "Owner",
      type: "m.room.message",
      origin_server_ts: 1000,
      content: { body: "private" },
    },
  ]);
  s.hydrateRooms(
    [
      {
        room_id: "b",
        name: "B",
        state: "join",
        role: "member",
        join_rule: "invite_only",
      },
    ],
    false,
  );
  assert(useChatStore.getState().messagesByRoom.a);
  assert(useChatStore.getState().rooms.a);
  s.hydrateRooms([
    {
      room_id: "b",
      name: "B",
      state: "join",
      role: "member",
      join_rule: "invite_only",
    },
  ]);
  assert.equal(useChatStore.getState().messagesByRoom.a, undefined);
  s.applyEvents([
    {
      event_id: "late",
      room_id: "a",
      room_seq: 2,
      sender_id: "owner",
      sender_display_name: "Owner",
      type: "m.room.message",
      origin_server_ts: 2000,
      content: { body: "late private" },
    },
  ]);
  assert.equal(useChatStore.getState().messagesByRoom.a, undefined);
  s.reset();
});

test("plugin acknowledgement timeout survives reload and retries the admitted event with the same transaction", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const storage = memory(),
    calls: string[] = [];
  const send = async (_r: string, txn: string) => {
    calls.push(txn);
    return { event_id: txn };
  };
  const q = queue(storage, send);
  const txn = q.enqueue("room", "checklist", "list", 1, "check_item", {
    item_id: "a",
  });
  await q.flush();
  assert.equal(q.items[0].status, "waiting");
  t.mock.timers.tick(30001);
  assert.equal(q.items[0].status, "failed");
  assert.equal(q.items[0].eventId, txn);
  q.close();
  const resumed = queue(storage, send);
  await resumed.retry(txn);
  assert.deepEqual(calls, [txn, txn]);
  resumed.observe([ack(txn)]);
  assert.equal(resumed.items.length, 0);
  resumed.close();
});

test("money formatting and aggregates retain cents beyond the safe-number total", () => {
  assert.match(brl(Number.MAX_SAFE_INTEGER), /90\.071\.992\.547\.409,91$/);
  const totals = billTotals(
    [
      {
        status: "paid",
        confirmed_amount_minor: Number.MAX_SAFE_INTEGER,
        paid_amount_minor: Number.MAX_SAFE_INTEGER,
      },
      { status: "paid", confirmed_amount_minor: 2, paid_amount_minor: 2 },
    ],
    "2026-10-15",
  );
  assert.equal(totals.paid, BigInt("9007199254740993"));
  assert.match(brl(totals.paid), /90\.071\.992\.547\.409,93$/);
});


test("recovery finds a missed authoritative ACK without resending or trusting a newer snapshot", async () => {
  let sends = 0;
  const storage = memory();
  const options = { storage, scope: { server: "test", namespace: "default", user: "owner" }, uuid: () => "txn", publishers: trust.publishers,
    validView: (_p: string, _i: string, v: any) => Number.isSafeInteger(v?.revision),
    send: async () => { sends++; return { event_id: "command" }; } };
  const q = new CommandQueue(options);
  q.enqueue("room", "checklist", "list", 1, "share", { preview_token: "token" });
  await q.flush(); q.close();
  const resumed = new CommandQueue({ ...options, recover: async () => [ack("other", 10), ack("command", 2)] });
  resumed.setRooms(new Set(["room"]));
  await resumed.retry("txn");
  assert.equal(sends, 1);
  assert.equal(resumed.items.length, 0);
  resumed.close();
});


test("BRL display opens empty and populated bills when Intl rejects BigInt as on Android", (t) => {
  const NumberFormat = Intl.NumberFormat;
  t.mock.method(Intl, "NumberFormat", function (...args: any[]) {
    const formatter = new NumberFormat(...args);
    return { format(value: number | bigint) {
      if (typeof value === "bigint") throw new TypeError("Cannot convert BigInt to number");
      return formatter.format(value);
    } };
  });
  const empty = billTotals([], "2026-10-15");
  assert.equal(brl(empty.suggested), "R$\u00a00,00");
  assert.equal(brl(empty.confirmed), "R$\u00a00,00");
  assert.equal(brl(empty.paid), "R$\u00a00,00");
  assert.equal(brl(1), "R$\u00a00,01");
  assert.equal(brl(123456), "R$\u00a01.234,56");
  assert.equal(brl(BigInt("9007199254740993")), "R$\u00a090.071.992.547.409,93");
  assert.equal(brl(null), "—");
  assert.equal(brl(undefined), "—");
});

test("remote bill values update untouched fields and preserve in-progress edits", async () => {
  const { billAmountInput, reconcileBillAmountInput } = await import("../src/monthly-bills.ts");
  assert.equal(billAmountInput({ confirmed_amount_minor: null, suggested_amount_minor: 24250 }), "242,50");
  assert.equal(billAmountInput({ confirmed_amount_minor: 0, suggested_amount_minor: 24250 }), "0,00");
  assert.equal(reconcileBillAmountInput("242,50", "242,50", "287,40"), "287,40");
  assert.equal(reconcileBillAmountInput("999,00", "242,50", "287,40"), "999,00");
  assert.equal(reconcileBillAmountInput("287,4", "242,50", "287,40"), "287,40");
  assert.equal(reconcileBillAmountInput("", "242,50", "287,40"), "");
  assert.equal(reconcileBillAmountInput("digitando", "242,50", ""), "digitando");
});
