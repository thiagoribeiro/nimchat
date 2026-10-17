import { t } from "@nimchat/i18n";
import { billMonthLabel, billOpenLabel, useMonthlyBills } from "@nimchat/brian";
import type { BillsProps } from "@nimchat/brian";
import type { ReactNode } from "react";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { BillsOverview } from "./bills-overview";
import { BillsPanels } from "./bills-panels";
import { BillsSheet } from "./bills-sheet";
import { s } from "./bills-styles";

export function MonthlyBills(props: BillsProps & { management?: ReactNode }) {
  const c = useMonthlyBills(props),
    [year, setYear] = useState(Number(c.month.slice(0, 4)));
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
      <View style={s.stack}>
        <Text style={s.text}>
          {t("{month} · {pending} pending · {overdue} overdue", { month: billMonthLabel(c.month), pending: c.totals.pending, overdue: c.totals.overdue })}
        </Text>
        <Text style={s.muted}>{t("Unpaid: {amount}", { amount: billOpenLabel(c.totals) })}</Text>
        <Button
          label={t("Open bills")}
          variant="ghost"
          onPress={() => props.onOpen?.()}
        />
      </View>
    );
  return (
    <View style={s.main}>
      <BillsOverview
        c={c}
        onPickMonth={() => {
          setYear(Number(c.month.slice(0, 4)));
          c.open("month");
        }}
      />
      {c.editable && (
        <Button
          label={t("+ Add bill")}
          variant="ghost"
          disabled={c.busy}
          onPress={() => c.open("new")}
        />
      )}
      {!!c.error && !c.panel && (
        <Text style={s.error} accessibilityRole="alert">
          {t(c.error)}
        </Text>
      )}
      <BillsSheet open={!!c.panel} title={title} close={c.close}>
        <BillsPanels
          c={c}
          year={year}
          setYear={setYear}
          management={props.management}
        />
      </BillsSheet>
    </View>
  );
}
