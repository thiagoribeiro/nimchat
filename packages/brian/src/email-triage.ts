// Application-owned rendering logic for the email_triage plugin (R2-D2's mailbox
// surface). The producer owns `view.view`; the owner's taps are plugin commands
// that become pending decisions until the producer reports them applied/failed.
// No message body ever reaches this view, and nothing here talks to an agent.
import { t } from "@nimchat/i18n";
import { brl } from "./monthly-bills.ts";

type Data = Record<string, any>;
const object = (x: unknown): x is Data =>
  !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown, max = 500) => typeof x === "string" && x.length <= max;
const list = (x: unknown, max: number) => Array.isArray(x) && x.length <= max;

export const EMAIL_COMMANDS = [
  "mark_done",
  "not_important",
  "should_alert",
  "group_mine",
  "group_not_mine",
  "group_unsure",
  "undo_batch",
] as const;
export type EmailCommand = (typeof EMAIL_COMMANDS)[number];

function validRows(rows: unknown, max: number, extra?: (r: Data) => boolean) {
  if (rows === undefined) return true;
  if (!list(rows, max)) return false;
  const seen = new Set<string>();
  for (const r of rows as unknown[]) {
    if (!object(r) || !str(r.id, 160) || seen.has(r.id)) return false;
    seen.add(r.id);
    if (extra && !extra(r)) return false;
  }
  return true;
}
const item = (r: Data) =>
  str(r.from, 120) &&
  str(r.subject, 90) &&
  str(r.received_at, 40) &&
  (r.priority === undefined || ["act", "follow", "info"].includes(r.priority)) &&
  (r.due === undefined || /^\d{4}-\d{2}-\d{2}$/.test(r.due)) &&
  (r.amount_cents === undefined ||
    (Number.isSafeInteger(r.amount_cents) && r.amount_cents >= 0)) &&
  (r.gmail_url === undefined ||
    (str(r.gmail_url, 300) && r.gmail_url.startsWith("https://mail.google.com/")));
const group = (r: Data) =>
  str(r.name, 120) &&
  Number.isSafeInteger(r.count) &&
  (r.samples === undefined ||
    (list(r.samples, 5) &&
      r.samples.every(
        (s: unknown) => object(s) && str(s.from, 120) && str(s.subject, 90) && str(s.date, 32),
      )));

export function validEmailTriage(v: unknown): boolean {
  if (
    !object(v) ||
    typeof v.title !== "string" ||
    typeof v.owner_id !== "string" ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 1 ||
    v.status !== "open" ||
    !Number.isSafeInteger(v.producer_sequence) ||
    !object(v.view) ||
    !list(v.decisions, 200)
  )
    return false;
  const view = v.view;
  const cleanup = view.cleanup;
  if (cleanup !== undefined && !object(cleanup)) return false;
  if (
    !validRows(view.important, 50, item) ||
    !validRows(view.recent, 100, item) ||
    !validRows(cleanup?.review, 50, group) ||
    !validRows(cleanup?.wrong, 50, group) ||
    !validRows(cleanup?.batches, 20, (b) => str(b.kind, 40) && Number.isSafeInteger(b.count))
  )
    return false;
  for (const d of v.decisions)
    if (
      !object(d) ||
      !str(d.id, 40) ||
      !EMAIL_COMMANDS.includes(d.command) ||
      !str(d.target, 160) ||
      !["pending", "applied", "failed"].includes(d.state)
    )
      return false;
  return true;
}

export type EmailRowState = "idle" | "pending" | "failed";
interface Command {
  command: string;
  payload: Data;
  status: string;
  error?: string;
}
const targetOf = (payload: Data) =>
  String(payload?.item_id ?? payload?.group_id ?? payload?.batch_id ?? "");

// Pending if the plugin journaled a decision not yet applied, or the client
// still holds an unconfirmed command about the same target.
export function emailRowStates(
  state: Data,
  commands: readonly Command[],
): Map<string, { state: EmailRowState; error?: string; command?: string }> {
  const out = new Map<string, { state: EmailRowState; error?: string; command?: string }>();
  for (const d of state.decisions ?? []) {
    if (d.state === "pending") out.set(d.target, { state: "pending", command: d.command });
    else if (d.state === "failed")
      out.set(d.target, { state: "failed", error: d.error, command: d.command });
    else out.delete(d.target);
  }
  for (const c of commands) {
    const target = targetOf(c.payload);
    if (!target) continue;
    if (c.status === "rejected")
      out.set(target, { state: "failed", error: c.error, command: c.command });
    else out.set(target, { state: "pending", command: c.command });
  }
  return out;
}

// A row whose decision removes it from its list disappears at once (optimistic).
const hides: Record<string, string[]> = {
  important: ["mark_done", "not_important"],
  recent: ["should_alert"],
  review: ["group_mine", "group_not_mine", "group_unsure"],
  wrong: ["group_mine"],
  batches: ["undo_batch"],
};
export function emailTabs(state: Data, commands: readonly Command[]) {
  const rows = emailRowStates(state, commands);
  const view = state.view ?? {};
  const cleanup = view.cleanup ?? {};
  const visible = (kind: string, xs: Data[] | undefined) =>
    (xs ?? []).filter((x) => {
      const r = rows.get(x.id);
      return !(r?.state === "pending" && hides[kind].includes(r.command ?? ""));
    });
  const failures = [...rows.entries()]
    .filter(([, r]) => r.state === "failed")
    .map(([target, r]) => ({ target, ...r }));
  return {
    important: visible("important", view.important),
    recent: visible("recent", view.recent),
    review: visible("review", cleanup.review),
    wrong: visible("wrong", cleanup.wrong),
    batches: visible("batches", cleanup.batches),
    week: (cleanup.week ?? {}) as Record<string, number>,
    pending: [...rows.values()].filter((r) => r.state === "pending").length,
    failures,
    updatedAt: view.updated_at as string | undefined,
    notice: view.notice as string | undefined,
  };
}

const day = (iso: string) => new Date(iso + "T12:00:00");
export function emailDueLabel(due: string | undefined, today = new Date()): string {
  if (!due) return "";
  const d = day(due);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const diff = Math.round((d.getTime() - base.getTime()) / 86400000);
  if (diff === 0) return t("due today");
  if (diff === 1) return t("due tomorrow");
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return diff < 0 ? t("was due {date}", { date }) : t("due {date}", { date });
}
export function emailItemDetail(item: Data, today = new Date()): string {
  const bits = [emailDueLabel(item.due, today)];
  if (item.amount_cents) bits.push(brl(item.amount_cents));
  if (!item.due && item.reason) bits.push(String(item.reason));
  return bits.filter(Boolean).join(" · ");
}
export function emailPriorityLabel(priority: string | undefined): string {
  return priority === "act"
    ? t("Act by")
    : priority === "follow"
      ? t("Follow up")
      : t("For your information");
}
export function emailBatchLabel(kind: string): string {
  return (
    {
      wrong: t("Wrong recipient"),
      review: t("Review"),
      bulk: t("Bulk"),
      archive: t("Archived"),
    } as Record<string, string>
  )[kind] ?? kind;
}
export function emailFailure(error: string | undefined): string {
  return error ? t("Not applied: {error}", { error }) : t("Not applied.");
}
