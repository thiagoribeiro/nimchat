"use client";
import { t } from "@nimchat/i18n";
import { brl, billMonthLabel, billOpenLabel, shortBillName } from "@nimchat/brian";
import type { useMonthlyBills } from "@nimchat/brian";
import { button } from "./bills-styles";

export type Bills = ReturnType<typeof useMonthlyBills>;

// Month navigation, totals, status filters and the grouped bill list.
export function BillsOverview({ c, onPickMonth }: { c: Bills; onPickMonth: () => void }) {
  const filters = [
    ["pending", t("Unpaid")],
    ["paid", t("filter::Paid")],
    ["all", t("All")]
  ] as const;
  return (
    <>
      <div className="flex items-center gap-1">
        <button
          className={button}
          disabled={c.busy}
          aria-label={t("Previous month")}
          onClick={() => c.shiftMonth(-1)}
        >
          ‹
        </button>
        <button
          className={
            button + " min-w-0 flex-1 break-words font-semibold capitalize"
          }
          onClick={onPickMonth}
        >
          {billMonthLabel(c.month)}
        </button>
        <button
          className={button}
          disabled={c.busy}
          aria-label={t("Next month")}
          onClick={() => c.shiftMonth(1)}
        >
          ›
        </button>
        <button
          className={button}
          aria-label={t("Bill options")}
          onClick={() => c.open("options")}
        >
          ⋯
        </button>
      </div>
      <div className="text-sm">
        <p>
          {t("{pending} pending · {overdue} overdue", { pending: c.totals.pending, overdue: c.totals.overdue })}
        </p>
        <p className="font-semibold">
          {t("Unpaid: {amount}", { amount: billOpenLabel(c.totals) })}
        </p>
        {c.totals.estimated > 0 && (
          <p className="text-xs text-slate-400">
            {t("Includes {count} estimate(s)", { count: c.totals.estimated })}
          </p>
        )}
      </div>
      <div
        className="flex gap-1 rounded-lg bg-slate-950/50 p-1"
        role="tablist"
        aria-label={t("Bills status")}
      >
        {filters.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={c.filter === key}
            className={
              button +
              " min-w-0 flex-1 break-words " +
              (c.filter === key
                ? "bg-violet-500/20 text-violet-200"
                : "text-slate-400")
            }
            onClick={() => c.setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {!c.monthExists && (
        <p className="text-sm text-slate-400">
          {c.busy
            ? t("Preparing month…")
            : t("This month has no entries yet.")}
        </p>
      )}
      <div className="divide-y divide-slate-700">
        {c.groups.map((group) => (
          <div key={group.name}>
            <button
              type="button"
              className="flex min-h-[60px] w-full items-center gap-2 py-2 text-left"
              aria-expanded={c.expanded === group.name}
              onClick={() => c.toggleGroup(group.name)}
            >
              <span aria-hidden>
                {c.expanded === group.name ? "⌄" : "›"}
              </span>
              <strong className="min-w-0 flex-1 break-words">
                {group.name}
              </strong>
              <span className="max-w-[48%] break-words text-right text-xs text-slate-400">
                <span className="block">{group.caption}</span>
                {group.subtotal != null && (
                  <span className="block">{group.subtotal}</span>
                )}
              </span>
            </button>
            {c.expanded === group.name && (
              <div className="pb-2">
                {group.entries.length ? (
                  group.entries.map((e) => (
                    <button
                      key={e.item_id}
                      type="button"
                      className="flex min-h-[64px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-800"
                      onClick={() => c.open("bill", e.item_id)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium">
                          {shortBillName(e.name, group.name)}
                        </span>
                        <span
                          className={
                            "block text-xs " +
                            (e.status === "pending" && e.due_date < c.today
                              ? "text-rose-300"
                              : "text-slate-400")
                          }
                        >
                          {e.status === "paid"
                            ? t("Paid")
                            : e.status === "cancelled"
                              ? t("Cancelled")
                              : (e.due_date < c.today ? t("Overdue on day {day}", { day: e.due_date.slice(8) }) : t("Due on day {day}", { day: e.due_date.slice(8) }))}
                        </span>
                      </span>
                      <span className="max-w-[48%] break-words text-right text-sm">
                        {e.status === "paid"
                          ? brl(e.paid_amount_minor)
                          : e.confirmed_amount_minor != null
                            ? brl(e.confirmed_amount_minor)
                            : e.suggested_amount_minor != null
                              ? `≈ ${brl(e.suggested_amount_minor)}`
                              : t("Enter amount")}{" "}
                        <span aria-hidden>›</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 pb-2 text-sm text-slate-400">
                    {t("No bills in this filter.")}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
