"use client";
import { t } from "@nimchat/i18n";
import { brl, billDateLabel, billGroup, billMonthName, validBillDate } from "@nimchat/brian";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { v4 as uuid } from "uuid";
import type { Bills } from "./bills-overview";
import { button, field } from "./bills-styles";

// Contents of the bills sheet: options, month picker, recurring bills,
// one bill's payment form and the confirmation of destructive actions.
export function BillsPanels({
  c,
  year,
  setYear,
  management
}: {
  c: Bills;
  year: number;
  setYear: Dispatch<SetStateAction<number>>;
  management?: ReactNode;
}) {
  const amountState =
    c.entry?.confirmed_amount_minor != null
      ? t("Confirmed amount")
      : c.entry?.suggested_amount_minor != null
        ? t("Previous estimate · {period}", { period: c.entry.suggestion_source_period })
        : t("No amount entered");
  return (
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
          {management}
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
            {t("Due date {date}", { date: billDateLabel(c.entry.due_date) })}
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
                  {t("Paid on {date}", { date: billDateLabel(c.entry.paid_on) })}
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
  );
}
