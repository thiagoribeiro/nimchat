"use client";
import { t } from "@nimchat/i18n";
import { billMonthLabel, billOpenLabel, useMonthlyBills } from "@nimchat/brian";
import type { BillsProps } from "@nimchat/brian";
import type { ReactNode } from "react";
import { useState } from "react";
import { BillsOverview } from "./bills-overview";
import { BillsPanels } from "./bills-panels";
import { BillsSheet } from "./bills-sheet";
import { button } from "./bills-styles";

export function MonthlyBills(
  props: BillsProps & { management?: ReactNode }
) {
  const c = useMonthlyBills(props);
  const [year, setYear] = useState(Number(c.month.slice(0, 4)));
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
      <BillsOverview
        c={c}
        onPickMonth={() => {
          setYear(Number(c.month.slice(0, 4)));
          c.open("month");
        }}
      />
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
        <BillsPanels c={c} year={year} setYear={setYear} management={props.management} />
      </BillsSheet>
    </section>
  );
}
