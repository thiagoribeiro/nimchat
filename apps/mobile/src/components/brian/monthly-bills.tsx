import { t } from "@nimchat/i18n";
import {
  brl,
  billGroup,
  billMonthLabel,
  billMonthName,
  billOpenLabel,
  shiftBillMonth,
  shortBillName,
  useMonthlyBills,
  validBillDate,
} from "@nimchat/brian";
import type { BillsProps } from "@nimchat/brian";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { v4 as uuid } from "uuid";
import { Button } from "@/components/ui/button";
import { colors } from "@/theme/tokens";
import { BillsSheet } from "./bills-sheet";
const dateLabel = (date: string) => date.split("-").reverse().join("/");
function Calendar({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange(value: string): void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(value.slice(0, 7));
  const start = new Date(month + "-01T12:00:00Z"),
    offset = (start.getUTCDay() + 6) % 7;
  const days = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return (
    <View style={s.stack}>
      <Button
        label={t("Payment date: {date}", { date: dateLabel(value) })}
        disabled={disabled}
        onPress={() => {
          setMonth(value.slice(0, 7));
          setOpen(!open);
        }}
      />
      {open && (
        <View style={s.calendar}>
          <View style={s.row}>
            <Button
              label="‹"
              accessibilityHint={t("Previous calendar month")}
              onPress={() => setMonth((m) => shiftBillMonth(m, -1))}
            />
            <Text style={[s.text, s.flex, s.center]}>
              {billMonthLabel(month)}
            </Text>
            <Button
              label="›"
              accessibilityHint={t("Next calendar month")}
              onPress={() => setMonth((m) => shiftBillMonth(m, 1))}
            />
          </View>
          <View style={s.grid}>
            {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
              <Text key={i} style={[s.weekday, s.muted]}>
                {d}
              </Text>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <View key={"blank" + i} style={s.day} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = month + "-" + String(i + 1).padStart(2, "0");
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={dateLabel(date)}
                  accessibilityState={{ selected: date === value }}
                  style={[s.day, date === value && s.selected]}
                  onPress={() => {
                    onChange(date);
                    setOpen(false);
                  }}
                >
                  <Text style={s.text}>{i + 1}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
export function MonthlyBills(props: BillsProps & { management?: ReactNode }) {
  const c = useMonthlyBills(props),
    [year, setYear] = useState(Number(c.month.slice(0, 4)));
  const [moreOpen, setMoreOpen] = useState(false);
  const amountState =
    c.entry?.confirmed_amount_minor != null
      ? t("Confirmed amount")
      : c.entry?.suggested_amount_minor != null
        ? `Estimativa anterior · ${c.entry.suggestion_source_period}`
        : t("No amount entered");
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
  const filters = [
    ["pending", t("Unpaid")],
    ["paid", t("filter::Paid")],
    ["all", t("All")],
  ] as const;
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
          onPress={() => {
            setYear(Number(c.month.slice(0, 4)));
            c.open("month");
          }}
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
                      accessibilityLabel={`${e.name}, ${e.status === "paid" ? t("Paid") : e.status === "cancelled" ? t("Cancelled") : t("due {date}", { date: dateLabel(e.due_date) })}, ${brl(e.status === "paid" ? e.paid_amount_minor : (e.confirmed_amount_minor ?? e.suggested_amount_minor))}`}
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
        {!!c.error && (
          <View style={s.alert}>
            <Text style={s.error} accessibilityRole="alert">
              {t(c.error)}
            </Text>
            {c.uncertain && (
              <Button
                label={t("Resend the same command")}
                disabled={c.busy}
                onPress={() => void c.retry()}
              />
            )}
          </View>
        )}
        {c.panel === "options" && (
          <>
            <Button
              label={t("Manage recurring bills")}
              onPress={() => c.open("manage")}
            />
            {props.management}
          </>
        )}
        {c.panel === "month" && (
          <>
            <View style={s.row}>
              <Button
                label="‹"
                accessibilityHint={t("Previous year")}
                onPress={() => setYear((y) => y - 1)}
              />
              <Text style={[s.text, s.flex, s.center]}>{year}</Text>
              <Button
                label="›"
                accessibilityHint={t("Next year")}
                onPress={() => setYear((y) => y + 1)}
              />
            </View>
            <View style={s.monthGrid}>
              {Array.from(
                { length: 12 },
                (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
              ).map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityState={{ selected: m === c.month }}
                  style={[s.month, m === c.month && s.selected]}
                  onPress={() => c.changeMonth(m)}
                >
                  <Text style={[s.text, s.capitalize]}>
                    {billMonthName(m)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {c.panel === "manage" && (
          <>
            {c.items
              .filter((i: any) => i.active)
              .map((i: any) => (
                <Pressable
                  key={i.id}
                  accessibilityRole="button"
                  accessibilityLabel={t("Edit {name}", { name: i.name })}
                  style={s.billRow}
                  onPress={() => c.open("edit", i.id)}
                >
                  <View style={s.flex}>
                    <Text style={s.text}>{i.name}</Text>
                    <Text style={s.small}>
                      {t("{group} · day {day}", { group: billGroup(i), day: i.due_day })}
                    </Text>
                  </View>
                  <Text style={s.muted}>›</Text>
                </Pressable>
              ))}
            {!c.items.some((i: any) => i.active) && (
              <Text style={s.muted}>{t("No recurring bills yet.")}</Text>
            )}
          </>
        )}
        {(c.panel === "new" || c.panel === "edit") && (
          <>
            <Text style={s.text}>{t("Bill name")}</Text>
            <TextInput
              accessibilityLabel={t("Bill name")}
              style={s.field}
              value={c.draft.name}
              maxLength={120}
              editable={c.canSave}
              onChangeText={(v) => c.edit("name", v)}
            />
            <Text style={s.text}>{t("Due day")}</Text>
            <TextInput
              accessibilityLabel={t("Due day")}
              style={s.field}
              value={c.draft.day}
              keyboardType="number-pad"
              maxLength={2}
              editable={c.canSave}
              onChangeText={(v) => c.edit("day", v)}
            />
            <Text style={s.text}>{t("Group")}</Text>
            <TextInput
              accessibilityLabel={t("Bill group")}
              style={s.field}
              value={c.draft.group}
              maxLength={80}
              editable={c.canSave}
              onChangeText={(v) => c.edit("group", v)}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={s.row}>
                {c.groups.map((g) => (
                  <Button
                    key={g.name}
                    label={g.name}
                    variant={c.draft.group === g.name ? "primary" : "ghost"}
                    disabled={!c.canSave}
                    onPress={() => c.edit("group", g.name)}
                  />
                ))}
              </View>
            </ScrollView>
            <Button
              label={c.busy ? t("Saving…") : t("Save bill")}
              variant="primary"
              disabled={
                !c.canSave ||
                !c.draft.name.trim() ||
                !/^([1-9]|[12]\d|3[01])$/.test(c.draft.day)
              }
              onPress={() =>
                void c.saveRecurrence(c.panel === "new" ? uuid() : c.item.id)
              }
            />
            {c.panel === "edit" && c.item?.active && (
              <Button
                label={t("Archive recurring bill")}
                variant="danger"
                disabled={!c.canSave}
                onPress={() => c.setDanger("archive_bill")}
              />
            )}
          </>
        )}
        {c.panel === "bill" && c.entry && (
          <>
            <Text style={s.muted}>
              {t("Due date")} {dateLabel(c.entry.due_date)}
            </Text>
            {c.entry.status === "pending" ? (
              <>
                <Text style={s.text}>{t("Amount in R$")}</Text>
                <TextInput
                  accessibilityLabel={t("Amount for {name}", { name: c.entry.name })}
                  style={s.field}
                  placeholder={t("Enter the amount")}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={c.draft.value}
                  editable={c.canSave}
                  onChangeText={(v) => c.edit("value", v)}
                />
                <Text style={s.small}>{amountState}</Text>
                <Calendar
                  value={c.draft.paidOn}
                  onChange={(v) => c.edit("paidOn", v)}
                  disabled={!c.canSave}
                />
                {c.noteOpen ? (
                  <TextInput
                    accessibilityLabel={t("Note")}
                    style={[s.field, { minHeight: 80 }]}
                    placeholder={t("Optional note")}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    value={c.draft.note}
                    maxLength={2000}
                    editable={c.canSave}
                    onChangeText={(v) => c.edit("note", v)}
                  />
                ) : (
                  <Button
                    label={t("+ Add note")}
                    variant="ghost"
                    onPress={() => c.setNoteOpen(true)}
                  />
                )}
                <Text style={s.small}>
                  {t("Confirming records this bill as paid with the amount and date above.")}
                </Text>
                <Button
                  label={c.busy ? t("Recording…") : t("Record payment")}
                  variant="primary"
                  disabled={
                    !c.canSave ||
                    c.cents == null ||
                    !validBillDate(c.draft.paidOn)
                  }
                  onPress={c.register}
                />
                <Button
                  label={t("Save amount only")}
                  variant="ghost"
                  disabled={!c.canSave || c.cents == null}
                  onPress={c.saveValue}
                />
                {c.editable && (
                  <>
                    <Button
                      label={t("More actions")}
                      variant="ghost"
                      onPress={() => setMoreOpen((value) => !value)}
                    />
                    {moreOpen && (
                      <>
                        <Button
                          label={t("Edit recurring bill")}
                          onPress={() => c.open("edit", c.item.id)}
                        />
                        <Button
                          label={t("Cancel entry")}
                          variant="danger"
                          disabled={!c.canSave}
                          onPress={() => c.setDanger("cancel_entry")}
                        />
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={s.text}>
                  {c.entry.status === "paid"
                    ? t("Paid · {amount}", { amount: brl(c.entry.paid_amount_minor) })
                    : t("Entry cancelled")}
                </Text>
                {c.entry.paid_on && (
                  <Text style={s.muted}>{t("On")} {dateLabel(c.entry.paid_on)}</Text>
                )}
                {c.entry.note && <Text style={s.text}>{c.entry.note}</Text>}
              </>
            )}
          </>
        )}
        {c.danger && (
          <View style={s.alert}>
            <Text style={s.text}>
              {c.danger === "archive_bill"
                ? t("Archive this recurring bill? Previous months are kept.")
                : t("Cancel this month's entry?")}
            </Text>
            <Button
              label={t("Back")}
              disabled={c.busy}
              onPress={() => c.setDanger(null)}
            />
            <Button
              label={t("Confirm")}
              variant="danger"
              disabled={!c.canSave}
              onPress={c.confirmDanger}
            />
          </View>
        )}
      </BillsSheet>
    </View>
  );
}
const s = StyleSheet.create({
  main: { gap: 10 },
  stack: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  flex: { flex: 1, minWidth: 0 },
  text: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  small: { fontSize: 12, color: colors.textMuted },
  bold: { fontWeight: "600" },
  center: { textAlign: "center" },
  capitalize: { textTransform: "capitalize" },
  icon: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { fontSize: 24, color: colors.text },
  filters: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  filter: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  selected: { backgroundColor: colors.primary + "30" },
  accent: { color: colors.primary },
  group: { borderBottomWidth: 1, borderBottomColor: colors.border },
  groupHeader: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  groupTotal: { alignItems: "flex-end", maxWidth: "48%" },
  billRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  amount: {
    fontSize: 13,
    color: colors.text,
    maxWidth: "48%",
    textAlign: "right",
  },
  empty: { padding: 12 },
  field: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  alert: {
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger + "80",
  },
  error: { color: colors.danger, fontSize: 13 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  month: {
    minHeight: 48,
    width: "31%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  calendar: { gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: {
    width: "14.2857%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  weekday: { width: "14.2857%", textAlign: "center", paddingVertical: 8 },
});
