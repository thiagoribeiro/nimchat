import { t } from "@nimchat/i18n";
import {
  emailBatchLabel,
  emailFailure,
  emailItemDetail,
  emailPriorityLabel,
  emailTabs
} from "@nimchat/brian";
import type { Block } from "@nimchat/brian";
import { useMemo, useState } from "react";
import type { PluginViewProps } from "./types";

type Tab = "important" | "recent" | "cleanup";
const small =
  "min-h-[44px] rounded-lg border border-[#334155] px-3 py-2 text-sm disabled:opacity-50";

// R2-D2's mailbox surface. Shows sender, subject and dates only — never a body —
// and never offers to ask an agent about it. Every tap is a plugin command that
// the producer carries out and reports.
export function EmailTriageView({
  view,
  owner,
  blocked,
  send,
  commands,
  focus,
  onOpen
}: PluginViewProps & {
  commands: readonly Block[];
  focus: boolean;
  onOpen?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("important");
  const [open, setOpen] = useState<string | null>(null);
  const tabs = useMemo(
    () => emailTabs(view, commands as any),
    [view, commands]
  );
  const can = owner && !blocked;
  const act = (command: string, payload: Record<string, unknown>) => {
    if (can) send(command, payload);
  };
  const row = (it: Block, actions: React.ReactNode) => (
    <li key={it.id} className="rounded-lg bg-[#0F172A] p-3">
      <p className="text-sm">
        {it.priority === "act" && (
          <span className="mr-1 text-amber-300" aria-label={emailPriorityLabel("act")}>
            ⚠
          </span>
        )}
        <span className="font-semibold">{it.from}</span> — {it.subject}
      </p>
      {(emailItemDetail(it) || it.priority) && (
        <p className="mt-1 text-xs text-slate-400">
          {[it.priority && emailPriorityLabel(it.priority), emailItemDetail(it)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {it.gmail_url && (
          <a
            className={small + " text-violet-300"}
            href={it.gmail_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Open in Gmail")}
          </a>
        )}
        {actions}
      </div>
    </li>
  );
  if (!focus)
    return (
      <div className="space-y-2 text-sm">
        <p>
          {t("{important} important · {review} to review", {
            important: tabs.important.length,
            review: tabs.review.length
          })}
        </p>
        <ul className="space-y-1 text-slate-300">
          {tabs.important.slice(0, 3).map((it) => (
            <li key={it.id}>
              {it.priority === "act" ? "⚠ " : "• "}
              {it.from} — {it.subject}
            </li>
          ))}
        </ul>
        {onOpen && (
          <button type="button" className={small + " text-violet-300"} onClick={onOpen}>
            {t("Open email")}
          </button>
        )}
      </div>
    );
  const tabButton = (id: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={
        "min-h-[44px] rounded-lg px-2.5 text-sm " +
        (tab === id ? "bg-violet-600 text-white" : "text-slate-300")
      }
    >
      {label}
    </button>
  );
  const groupRow = (g: Block, kind: "review" | "wrong") => (
    <li key={g.id} className="rounded-lg bg-[#0F172A] p-3">
      <button
        type="button"
        className="w-full text-left text-sm"
        aria-expanded={open === g.id}
        onClick={() => setOpen(open === g.id ? null : g.id)}
      >
        <span className="font-semibold">{g.name}</span>
        {g.domain ? ` · ${g.domain}` : ""} ·{" "}
        {t("{count} emails", { count: g.count })}
        {g.why ? <span className="block text-xs text-slate-400">{g.why}</span> : null}
      </button>
      {open === g.id && (
        <ul className="mt-2 space-y-1 text-xs text-slate-400">
          {(g.samples ?? []).map((s: Block, i: number) => (
            <li key={i}>
              {s.date} · {s.from} — {s.subject}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={small} disabled={!can} onClick={() => act("group_mine", { group_id: g.id })}>
          {t("It's mine")}
        </button>
        {kind === "review" && (
          <>
            <button type="button" className={small} disabled={!can} onClick={() => act("group_not_mine", { group_id: g.id })}>
              {t("Not mine")}
            </button>
            <button type="button" className={small} disabled={!can} onClick={() => act("group_unsure", { group_id: g.id })}>
              {t("Not sure")}
            </button>
          </>
        )}
      </div>
    </li>
  );
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={t("Email")} className="flex flex-wrap gap-0.5">
        {tabButton("important", t("Important ({count})", { count: tabs.important.length }))}
        {tabButton("recent", t("Recent"))}
        {tabButton("cleanup", t("Cleanup"))}
      </div>
      {tabs.notice && <p className="text-sm text-amber-300">{tabs.notice}</p>}
      {tabs.failures.map((f) => (
        <p key={f.target} role="alert" className="text-sm text-rose-300">
          {emailFailure(f.error)}
        </p>
      ))}
      {tabs.pending > 0 && (
        <p role="status" className="text-xs text-violet-300">
          {t("Applying {count} decision(s) to the mailbox…", { count: tabs.pending })}
        </p>
      )}
      {tab === "important" &&
        (tabs.important.length ? (
          <ul className="space-y-2">
            {tabs.important.map((it) =>
              row(
                it,
                <>
                  <button type="button" className={small} disabled={!can} onClick={() => act("mark_done", { item_id: it.id })}>
                    {it.priority === "act" ? t("I paid") : t("Seen")}
                  </button>
                  <button type="button" className={small} disabled={!can} onClick={() => act("not_important", { item_id: it.id })}>
                    {t("Wasn't important")}
                  </button>
                </>
              )
            )}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">{t("No important email open.")}</p>
        ))}
      {tab === "recent" &&
        (tabs.recent.length ? (
          <>
            <p className="text-xs text-slate-400">
              {t("Inbox mail from the last 48 h that did not alert you.")}
            </p>
            <ul className="space-y-2">
              {tabs.recent.map((it) =>
                row(
                  it,
                  <button type="button" className={small} disabled={!can} onClick={() => act("should_alert", { item_id: it.id })}>
                    {t("Should have alerted")}
                  </button>
                )
              )}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-400">{t("Nothing recent without an alert.")}</p>
        ))}
      {tab === "cleanup" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            {t("This week: {wrong} wrong-recipient and {bulk} bulk archived; {review} to review.", {
              wrong: tabs.week.archived_wrong ?? 0,
              bulk: tabs.week.archived_bulk ?? 0,
              review: tabs.week.review ?? 0
            })}
          </p>
          <section aria-label={t("Review")}>
            <h3 className="mb-2 text-sm font-semibold">{t("Review")}</h3>
            {tabs.review.length ? (
              <ul className="space-y-2">{tabs.review.map((g) => groupRow(g, "review"))}</ul>
            ) : (
              <p className="text-sm text-slate-400">{t("Nothing to review.")}</p>
            )}
          </section>
          <section aria-label={t("Wrong recipient")}>
            <h3 className="mb-2 text-sm font-semibold">{t("Wrong recipient")}</h3>
            <ul className="space-y-2">{tabs.wrong.map((g) => groupRow(g, "wrong"))}</ul>
          </section>
          <section aria-label={t("Batches")}>
            <h3 className="mb-2 text-sm font-semibold">{t("Batches")}</h3>
            <ul className="space-y-2">
              {tabs.batches.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#0F172A] p-3 text-sm">
                  <span>
                    {emailBatchLabel(b.kind)} · {t("{count} emails", { count: b.count })}
                    <span className="block text-xs text-slate-400">{b.id}</span>
                  </span>
                  <button
                    type="button"
                    className={small + " border-red-500/50 text-red-300"}
                    disabled={!can}
                    onClick={() => {
                      if (window.confirm(t("Undo this batch? Labels come off and archived mail returns to the Inbox.")))
                        act("undo_batch", { batch_id: b.id, confirmed: true });
                    }}
                  >
                    {t("Undo")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
