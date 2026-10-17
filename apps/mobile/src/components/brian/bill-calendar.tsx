import { t, locale } from "@nimchat/i18n";
import { billDateLabel, billMonthLabel, shiftBillMonth } from "@nimchat/brian";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { s } from "./bills-styles";

// Narrow weekday names from Monday, in the active locale (2024-01-01 is a Monday).
function weekdayInitials(): string[] {
  const format = new Intl.DateTimeFormat(locale(), { weekday: "narrow", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2024, 0, 1 + i))));
}

// Month calendar for picking a payment date (weeks start on Monday).
export function BillCalendar({
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
        label={t("Payment date: {date}", { date: billDateLabel(value) })}
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
            {weekdayInitials().map((d, i) => (
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
                  accessibilityLabel={billDateLabel(date)}
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
