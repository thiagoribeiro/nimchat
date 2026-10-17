import { t } from "@nimchat/i18n";
import {
  brl,
  billDateLabel,
  billMonthLabel,
  billOpenLabel,
  shortBillName,
} from "@nimchat/brian";
import type { useMonthlyBills } from "@nimchat/brian";
import { Pressable, Text, View } from "react-native";
import { s } from "./bills-styles";

export type Bills = ReturnType<typeof useMonthlyBills>;

// Month navigation, totals, status filters and the grouped bill list.
export function BillsOverview({ c, onPickMonth }: { c: Bills; onPickMonth: () => void }) {
  const filters = [
    ["pending", t("Unpaid")],
    ["paid", t("filter::Paid")],
    ["all", t("All")],
  ] as const;
  return (
    <>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Previous month")}
          disabled={c.busy}
          style={s.icon}
          onPress={() => c.shiftMonth(-1)}
        >
          <Text style={s.arrow}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Choose month: {month}", { month: billMonthLabel(c.month) })}
          style={[s.flex, s.icon]}
          onPress={onPickMonth}
        >
          <Text style={[s.text, s.bold, s.capitalize]}>
            {billMonthLabel(c.month)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Next month")}
          disabled={c.busy}
          style={s.icon}
          onPress={() => c.shiftMonth(1)}
        >
          <Text style={s.arrow}>›</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Bill options")}
          style={s.icon}
          onPress={() => c.open("options")}
        >
          <Text style={s.arrow}>⋯</Text>
        </Pressable>
      </View>
      <View>
        <Text style={s.muted}>
          {t("{pending} pending · {overdue} overdue", { pending: c.totals.pending, overdue: c.totals.overdue })}
        </Text>
        <Text style={[s.text, s.bold]}>
          {t("Unpaid: {amount}", { amount: billOpenLabel(c.totals) })}
        </Text>
        {c.totals.estimated > 0 && (
          <Text style={s.small}>{t("Includes {count} estimate(s)", { count: c.totals.estimated })}</Text>
        )}
      </View>
      <View style={s.filters}>
        {filters.map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: c.filter === key }}
            style={[s.filter, c.filter === key && s.selected]}
            onPress={() => c.setFilter(key)}
          >
            <Text style={[s.small, c.filter === key && s.accent]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {!c.monthExists && (
        <Text style={s.muted}>
          {c.busy
            ? t("Preparing month…")
            : t("This month has no entries yet.")}
        </Text>
      )}
      <View>
        {c.groups.map((group) => (
          <View key={group.name} style={s.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${group.name}, ${group.caption}${group.subtotal ? ", " + group.subtotal : ""}`}
              accessibilityState={{ expanded: c.expanded === group.name }}
              style={s.groupHeader}
              onPress={() => c.toggleGroup(group.name)}
            >
              <Text style={s.arrow}>
                {c.expanded === group.name ? "⌄" : "›"}
              </Text>
              <Text style={[s.text, s.bold, s.flex]}>{group.name}</Text>
              <View style={s.groupTotal}>
                <Text style={s.small}>{group.caption}</Text>
                {group.subtotal != null && (
                  <Text style={s.small}>{group.subtotal}</Text>
                )}
              </View>
            </Pressable>
            {c.expanded === group.name && (
              <View>
                {group.entries.length ? (
                  group.entries.map((e) => (
                    <Pressable
                      key={e.item_id}
                      accessibilityRole="button"
                      accessibilityLabel={`${e.name}, ${e.status === "paid" ? t("Paid") : e.status === "cancelled" ? t("Cancelled") : t("due {date}", { date: billDateLabel(e.due_date) })}, ${brl(e.status === "paid" ? e.paid_amount_minor : (e.confirmed_amount_minor ?? e.suggested_amount_minor))}`}
                      style={s.billRow}
                      onPress={() => c.open("bill", e.item_id)}
                    >
                      <View style={s.flex}>
                        <Text style={s.text}>
                          {shortBillName(e.name, group.name)}
                        </Text>
                        <Text
                          style={[
                            s.small,
                            e.status === "pending" &&
                              e.due_date < c.today &&
                              s.error,
                          ]}
                        >
                          {e.status === "paid"
                            ? t("Paid")
                            : e.status === "cancelled"
                              ? t("Cancelled")
                              : (e.due_date < c.today ? t("Overdue on day {day}", { day: e.due_date.slice(8) }) : t("Due on day {day}", { day: e.due_date.slice(8) }))}
                        </Text>
                      </View>
                      <Text style={s.amount}>
                        {e.status === "paid"
                          ? brl(e.paid_amount_minor)
                          : e.confirmed_amount_minor != null
                            ? brl(e.confirmed_amount_minor)
                            : e.suggested_amount_minor != null
                              ? `≈ ${brl(e.suggested_amount_minor)}`
                              : t("Enter amount")}
                      </Text>
                      <Text style={s.muted}>›</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={[s.muted, s.empty]}>
                    {t("No bills in this filter.")}
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
    </>
  );
}
