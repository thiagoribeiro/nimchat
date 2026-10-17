import { t } from "@nimchat/i18n";
import {
  brl,
  billDateLabel,
  billGroup,
  billMonthName,
  validBillDate,
} from "@nimchat/brian";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { v4 as uuid } from "uuid";
import { Button } from "@/components/ui/button";
import { colors } from "@/theme/tokens";
import { BillCalendar } from "./bill-calendar";
import type { Bills } from "./bills-overview";
import { s } from "./bills-styles";

// Contents of the bills sheet: options, month picker, recurring bills,
// one bill's payment form and the confirmation of destructive actions.
export function BillsPanels({
  c,
  year,
  setYear,
  management,
}: {
  c: Bills;
  year: number;
  setYear: Dispatch<SetStateAction<number>>;
  management?: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const amountState =
    c.entry?.confirmed_amount_minor != null
      ? t("Confirmed amount")
      : c.entry?.suggested_amount_minor != null
        ? t("Previous estimate · {period}", {
            period: c.entry.suggestion_source_period,
          })
        : t("No amount entered");
  return (
    <>
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
        {management}
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
          {t("Due date {date}", { date: billDateLabel(c.entry.due_date) })}
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
            <BillCalendar
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
              <Text style={s.muted}>
                {t("Paid on {date}", { date: billDateLabel(c.entry.paid_on) })}
              </Text>
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
    </>
  );
}
