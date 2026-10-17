"use client";
import { t } from "@nimchat/i18n";
import {
  brl,
  billMonthLabel,
  billMonthName,
  billOpenLabel,
  billGroup,
  shortBillName,
  validBillDate,
  useMonthlyBills
} from "@nimchat/brian";
import type { BillsProps } from "@nimchat/brian";
import type { ReactNode } from "react";
import { useState } from "react";
import { v4 as uuid } from "uuid";
import { BillsSheet } from "./bills-sheet";
const button =
  "min-h-[44px] min-w-[44px] rounded-lg px-[8px] text-sm disabled:opacity-40";
const field =
  "min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-base";
export function MonthlyBills(
  props: BillsProps & { management?: ReactNode }
) {
  const c = useMonthlyBills(props);
  const [year, setYear] = useState(Number(c.month.slice(0, 4)));
  const amountState =
    c.entry?.confirmed_amount_minor != null
      ? t("Confirmed amount")
      : c.entry?.suggested_amount_minor != null
        ? `Estimativa anterior · ${c.entry.suggestion_source_period}`
        : t("No amount entered");
  const filters = [
    ["pending", t("Unpaid")],
    ["paid", t("filter::Paid")],
    ["all", t("All")]
  ] as const;
  const title =
    c.panel === "bill"
      ? (c.entry?.name ?? t("Bill"))
      : c.panel === "month"
        ? t("Choose month")
        : c.panel === "new"
          ? t("Add bill")
          : c.panel === "edit"
            ? t("Edit recurring bill")
            : c.panel === "options"
              ? t("Options")
              : t("Manage recurring bills");
  if (props.focus === false)
    return (
      <div className="space-y-1 text-sm">
        <p>
          {t("{month} · {pending} pending · {overdue} overdue", { month: billMonthLabel(c.month), pending: c.totals.pending, overdue: c.totals.overdue })}
        </p>
        <p>{t("Unpaid: {amount}", { amount: billOpenLabel(c.totals) })}</p>
        <button
          className={button + " text-violet-300"}
          onClick={props.onOpen}
        >
          {t("Open bills")}
        </button>
      </div>
    );
  return (
    <section aria-label={t("Bills to pay")} className="space-y-3">
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
          onClick={() => {
            setYear(Number(c.month.slice(0, 4)));
            c.open("month");
          }}
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
      {c.editable && (
        <button
          className={button + " w-full text-violet-300"}
          disabled={c.busy}
          onClick={() => c.open("new")}
        >
          {t("+ Add bill")}
        </button>
      )}
      {!!c.error && !c.panel && (
        <p role="alert" className="text-sm text-rose-300">
          {t(c.error)}
        </p>
      )}
      <BillsSheet open={!!c.panel} title={title} close={c.close}>
        <div className="space-y-4">
          {!!c.error && (
            <div
              role="alert"
              className="rounded-lg bg-rose-950/40 p-3 text-sm text-rose-200"
            >
              {t(c.error)}
              {c.uncertain && (
                <button
                  className={button + " block"}
                  disabled={c.busy}
                  onClick={() => void c.retry()}
                >
                  {t("Resend the same command")}
                </button>
              )}
            </div>
          )}
          {c.panel === "options" && (
            <>
              <button
                className={button + " w-full bg-slate-800"}
                onClick={() => c.open("manage")}
              >
                {t("Manage recurring bills")}
              </button>
              {props.management}
            </>
          )}
          {c.panel === "month" && (
            <>
              <div className="flex items-center justify-between">
                <button
                  className={button}
                  onClick={() => setYear((y) => y - 1)}
                  aria-label={t("Previous year")}
                >
                  ‹
                </button>
                <strong>{year}</strong>
                <button
                  className={button}
                  onClick={() => setYear((y) => y + 1)}
                  aria-label={t("Next year")}
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from(
                  { length: 12 },
                  (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`
                ).map((m) => (
                  <button
                    key={m}
                    className={
                      button +
                      " capitalize " +
                      (m === c.month ? "bg-violet-500/30" : "bg-slate-800")
                    }
                    onClick={() => c.changeMonth(m)}
                  >
                    {billMonthName(m)}
                  </button>
                ))}
              </div>
            </>
          )}
          {c.panel === "manage" && (
            <>
              {c.items
                .filter((i: any) => i.active)
                .map((i: any) => (
                  <button
                    key={i.id}
                    className={
                      button +
                      " flex w-full items-center justify-between text-left bg-slate-800"
                    }
                    onClick={() => c.open("edit", i.id)}
                  >
                    <span>
                      {i.name}
                      <span className="block text-xs text-slate-400">
                        {t("{group} · day {day}", { group: billGroup(i), day: i.due_day })}
                      </span>
                    </span>
                    <span>›</span>
                  </button>
                ))}
              {!c.items.some((i: any) => i.active) && (
                <p>{t("No recurring bills yet.")}</p>
              )}
            </>
          )}
          {(c.panel === "new" || c.panel === "edit") && (
            <>
              <label className="block space-y-1">
                <span>{t("Bill name")}</span>
                <input
                  className={field}
                  value={c.draft.name}
                  maxLength={120}
                  onChange={(e) => c.edit("name", e.target.value)}
                  disabled={!c.canSave}
                />
              </label>
              <label className="block space-y-1">
                <span>{t("Due day")}</span>
                <input
                  className={field}
                  type="number"
                  min={1}
                  max={31}
                  value={c.draft.day}
                  onChange={(e) => c.edit("day", e.target.value)}
                  disabled={!c.canSave}
                />
              </label>
              <label className="block space-y-1">
                <span>{t("Group")}</span>
                <input
                  className={field}
                  list="bills-groups"
                  value={c.draft.group}
                  maxLength={80}
                  onChange={(e) => c.edit("group", e.target.value)}
                  disabled={!c.canSave}
                />
                <datalist id="bills-groups">
                  {c.groups.map((g) => (
                    <option key={g.name} value={g.name} />
                  ))}
                </datalist>
              </label>
              <button
                className={button + " w-full bg-violet-600 text-white"}
                disabled={
                  !c.canSave ||
                  !c.draft.name.trim() ||
                  !/^([1-9]|[12]\d|3[01])$/.test(c.draft.day)
                }
                onClick={() =>
                  void c.saveRecurrence(
                    c.panel === "new" ? uuid() : c.item.id
                  )
                }
              >
                {c.busy ? t("Saving…") : t("Save bill")}
              </button>
              {c.panel === "edit" && c.item?.active && (
                <button
                  className={button + " text-rose-300"}
                  disabled={!c.canSave}
                  onClick={() => c.setDanger("archive_bill")}
                >
                  {t("Archive recurring bill")}
                </button>
              )}
            </>
          )}
          {c.panel === "bill" && c.entry && (
            <>
              <p className="text-sm text-slate-400">
                {t("Due date")}{" "}
                {c.entry.due_date.split("-").reverse().join("/")}
              </p>
              {c.entry.status === "pending" ? (
                <>
                  <label className="block space-y-1">
                    <span>{t("Amount in R$")}</span>
                    <input
                      className={field}
                      inputMode="decimal"
                      aria-label={t("Amount in R$")}
                      value={c.draft.value}
                      placeholder={t("Enter the amount")}
                      disabled={!c.canSave}
                      onChange={(e) => c.edit("value", e.target.value)}
                    />
                    <span className="block text-xs text-slate-400">
                      {amountState}
                    </span>
                  </label>
                  <label className="block space-y-1">
                    <span>{t("Payment date")}</span>
                    <input
                      className={field}
                      type="date"
                      value={c.draft.paidOn}
                      disabled={!c.canSave}
                      onChange={(e) => c.edit("paidOn", e.target.value)}
                    />
                  </label>
                  {c.noteOpen ? (
                    <label className="block space-y-1">
                      <span>{t("Note")}</span>
                      <textarea
                        className={field}
                        value={c.draft.note}
                        maxLength={2000}
                        onChange={(e) => c.edit("note", e.target.value)}
                        disabled={!c.canSave}
                      />
                    </label>
                  ) : (
                    <button
                      className={button + " text-slate-300"}
                      onClick={() => c.setNoteOpen(true)}
                    >
                      {t("+ Add note")}
                    </button>
                  )}
                  <p className="text-xs text-slate-400">
                    {t("Confirming records this bill as paid with the amount and date above.")}
                  </p>
                  <button
                    className={
                      button +
                      " w-full bg-violet-600 font-semibold text-white"
                    }
                    disabled={
                      !c.canSave ||
                      c.cents == null ||
                      !validBillDate(c.draft.paidOn)
                    }
                    onClick={c.register}
                  >
                    {c.busy ? t("Recording…") : t("Record payment")}
                  </button>
                  <button
                    className={button + " w-full text-violet-300"}
                    disabled={!c.canSave || c.cents == null}
                    onClick={c.saveValue}
                  >
                    {t("Save amount only")}
                  </button>
                  {c.editable && (
                    <details>
                      <summary
                        className={
                          button + " cursor-pointer text-slate-400"
                        }
                      >
                        {t("More actions")}
                      </summary>
                      <button
                        className={button}
                        onClick={() => c.open("edit", c.item.id)}
                      >
                        {t("Edit recurring bill")}
                      </button>
                      <button
                        className={button + " text-rose-300"}
                        onClick={() => c.setDanger("cancel_entry")}
                      >
                        {t("Cancel entry")}
                      </button>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p>
                    {c.entry.status === "paid"
                      ? t("Paid · {amount}", { amount: brl(c.entry.paid_amount_minor) })
                      : t("Entry cancelled")}
                  </p>
                  {c.entry.paid_on && (
                    <p>
                      {t("On")} {c.entry.paid_on.split("-").reverse().join("/")}
                    </p>
                  )}
                  {c.entry.note && <p>{c.entry.note}</p>}
                </>
              )}
            </>
          )}
          {c.danger && (
            <div
              role="alert"
              className="space-y-2 rounded-lg border border-rose-700 p-3"
            >
              <p>
                {c.danger === "archive_bill"
                  ? t("Archive this recurring bill? Previous months are kept.")
                  : t("Cancel this month's entry?")}
              </p>
              <button
                className={button}
                disabled={c.busy}
                onClick={() => c.setDanger(null)}
              >
                {t("Back")}
              </button>
              <button
                className={button + " bg-rose-700"}
                disabled={!c.canSave}
                onClick={c.confirmDanger}
              >
                {t("Confirm")}
              </button>
            </div>
          )}
        </div>
      </BillsSheet>
    </section>
  );
}
