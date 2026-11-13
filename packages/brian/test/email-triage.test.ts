import { test } from "node:test";
import assert from "node:assert/strict";
import { setLocale } from "@nimchat/i18n";
import { emailTabs, emailDueLabel, emailItemDetail, validEmailTriage } from "../src/email-triage.ts";
import { supported, project, activeSurfaces } from "../src/index.ts";
setLocale("en");
// Fictitious mailbox: no real names or addresses.
const view = () => ({
  title: "Email", description: "", owner_id: "@owner", revision: 3, status: "open", producer_sequence: 2,
  view: {
    updated_at: "2026-11-13T12:00:00-03:00",
    important: [
      { id: "msg:1", short_id: "0001", from: "Bank", subject: "Card bill", received_at: "2026-11-13T10:00:00-03:00", priority: "act", due: "2026-11-14", amount_cents: 123456, gmail_url: "https://mail.google.com/mail/u/0/#all/abc" },
      { id: "msg:2", short_id: "0002", from: "Ana", subject: "Lunch", received_at: "2026-11-13T11:00:00-03:00", priority: "follow", reason: "contact" },
    ],
    recent: [{ id: "msg:3", from: "Shop", subject: "Order shipped", received_at: "2026-11-13T09:00:00-03:00" }],
    cleanup: {
      week: { archived_wrong: 12, archived_bulk: 340, review: 2 },
      review: [{ id: "grp:a", name: "joao silva pereira", domain: "telecom.example", count: 3, samples: [{ date: "2026-11-01", from: "Telecom", subject: "Bill" }] }],
      wrong: [{ id: "grp:b", name: "joao souza lima", domain: "shop.example", count: 9 }],
      batches: [{ id: "20261113-090839-archive-wrong", kind: "archive", count: 1826, at: "2026-11-13T09:08:39-03:00" }],
    },
  },
  decisions: [] as any[],
});
const block = (v: any) => ({ type: "plugin", plugin: "email_triage", version: "1.0", schema_version: "1.0", instance_id: "i1", fallback_markdown: "Email", view: v });

test("a valid email surface is supported; bodies, scripts and bad links are not", () => {
  assert.equal(validEmailTriage(view()), true);
  assert.equal(supported(block(view())), true);
  const bad = [
    (v: any) => (v.status = "archived"),
    (v: any) => (v.view.important[0].gmail_url = "javascript:alert(1)"),
    (v: any) => (v.view.important[0].subject = "x".repeat(91)),
    (v: any) => v.view.important.push({ ...v.view.important[0] }), // duplicate id
    (v: any) => (v.view.cleanup.review[0].samples = Array(6).fill(v.view.cleanup.review[0].samples[0])),
    (v: any) => v.decisions.push({ id: "d1", command: "delete_mail", target: "msg:1", state: "pending" }),
    (v: any) => (v.view.cleanup = []),
  ];
  for (const mutate of bad) {
    const v = view();
    mutate(v);
    assert.equal(validEmailTriage(v), false, mutate.toString());
  }
});

test("pending decisions hide their rows at once; failures are reported", () => {
  const v = view();
  v.decisions = [
    { id: "d4", command: "mark_done", target: "msg:1", state: "pending", actor: "@owner", created_at: "x" },
    { id: "d5", command: "group_unsure", target: "grp:a", state: "failed", error: "imap", actor: "@owner", created_at: "x" },
  ];
  const local = [{ command: "undo_batch", payload: { batch_id: "20261113-090839-archive-wrong", confirmed: true }, status: "sending" }];
  const tabs = emailTabs(v, local);
  assert.deepEqual(tabs.important.map((i) => i.id), ["msg:2"]);
  assert.deepEqual(tabs.batches, []);
  assert.deepEqual(tabs.review.map((g) => g.id), ["grp:a"]); // failed: stays, with the error
  assert.deepEqual(tabs.failures.map((f) => [f.target, f.error]), [["grp:a", "imap"]]);
  assert.equal(tabs.pending, 2);
  // the producer applied it: no longer pending nor failed
  v.decisions[0].state = "applied";
  assert.equal(emailTabs(v, []).pending, 0);
  // a rejected client command is a failure, not a hidden row
  const rejected = emailTabs(view(), [{ command: "mark_done", payload: { item_id: "msg:2" }, status: "rejected", error: "target no longer in view" }]);
  assert.deepEqual(rejected.important.map((i) => i.id), ["msg:1", "msg:2"]);
  assert.equal(rejected.failures[0].target, "msg:2");
});

test("due date and amount labels", () => {
  const today = new Date(2026, 10, 13, 9);
  assert.equal(emailDueLabel("2026-11-13", today), "due today");
  assert.equal(emailDueLabel("2026-11-14", today), "due tomorrow");
  assert.equal(emailDueLabel("2026-11-20", today), "due 20/11");
  assert.equal(emailDueLabel("2026-11-10", today), "was due 10/11");
  assert.match(emailItemDetail(view().view.important[0], today), /^due tomorrow · R\$\s?1\.234,56$/);
  assert.equal(emailItemDetail(view().view.important[1], today), "contact");
  setLocale("pt-BR");
  assert.equal(emailDueLabel("2026-11-14", today), "vence amanhã");
  setLocale("en");
});

test("the surface is pinned while open and projects from the publisher only", () => {
  const trust = { publishers: new Set(["@blocks"]), agents: new Set<string>(), userId: "@owner" };
  const ev = (sender: string, seq: number) => ({ event_id: "e" + seq, room_id: "!r", sender_id: sender, type: "m.plugin.state.updated", room_seq: seq, content: { plugin: "email_triage", instance_id: "i1", view: view() } });
  const surfaces = project([ev("@intruder", 1)], trust);
  assert.equal(surfaces.size, 0);
  const active = activeSurfaces(project([ev("@blocks", 2)], trust));
  assert.equal(active.length, 1);
  assert.equal(active[0].title, "Email");
});
