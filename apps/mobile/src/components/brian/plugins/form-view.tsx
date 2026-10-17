import { t } from "@nimchat/i18n";
import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { formInputValue, formValues, reconcileDraft } from "@nimchat/brian";
import type { Block } from "@nimchat/brian";
import type { CommandResult } from "@nimchat/sdk/commands";
import { colors } from "@/theme/tokens";
import { Button } from "./button";
import { styles } from "./styles";
import type { PluginViewProps } from "./types";

// Local draft of a stateful form. Authoritative snapshots reconcile untouched
// fields; the user's own acknowledged result clears the dirty marks.
export function FormView({
  view,
  owner,
  disabled,
  send,
  result,
  revision,
  instanceId,
}: PluginViewProps & {
  result?: CommandResult;
  revision?: number;
  instanceId: string;
}) {
  const [draft, setDraft] = useState(() => ({
    values: formValues(view),
    dirty: {} as Record<string, boolean>,
  }));
  const values = draft.values;
  const setValue = (id: string, value: unknown) =>
    setDraft((d) => ({
      values: { ...d.values, [id]: value },
      dirty: { ...d.dirty, [id]: true },
    }));
  const acknowledged = useRef<string | undefined>(undefined);
  useEffect(() => {
    const own =
      !!result &&
      result.eventId !== acknowledged.current &&
      view.revision >= result.revision;
    if (own) acknowledged.current = result.eventId;
    setDraft((d) => reconcileDraft(d, view, own));
    // Reconcile on new authoritative revisions, not on every overlay render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, instanceId, result]);
  return (
    <>
      {(view.fields ?? []).map((field: Block) => (
        <View key={field.id} style={styles.formField}>
          <Text style={styles.body}>
            {field.label}
            {field.required ? " *" : ""}
          </Text>
          {field.type === "boolean" ? (
            <View style={styles.actions}>
              {[true, false].map((value) => (
                <Button
                  key={String(value)}
                  label={`${values[field.id] === value ? "✓ " : ""}${value ? t("Yes") : t("No")}`}
                  disabled={
                    disabled ||
                    !owner ||
                    ["submitted", "cancelled"].includes(view.status)
                  }
                  action={() => setValue(field.id, value)}
                />
              ))}
            </View>
          ) : field.type === "select" ? (
            <View style={styles.actions}>
              {(field.options ?? []).map((option: string) => (
                <Button
                  key={option}
                  label={`${values[field.id] === option ? "✓ " : ""}${option}`}
                  disabled={
                    disabled ||
                    !owner ||
                    ["submitted", "cancelled"].includes(view.status)
                  }
                  action={() => setValue(field.id, option)}
                />
              ))}
            </View>
          ) : (
            <TextInput
              accessibilityLabel={field.label}
              style={styles.input}
              value={
                values[field.id] === undefined
                  ? ""
                  : String(values[field.id])
              }
              placeholder={field.type === "date" ? t("YYYY-MM-DD") : ""}
              placeholderTextColor={colors.textFaint}
              editable={
                !disabled &&
                owner &&
                !["submitted", "cancelled"].includes(view.status)
              }
              keyboardType={
                field.type === "number" ? "decimal-pad" : "default"
              }
              onChangeText={(v) =>
                setValue(field.id, formInputValue(field.type, v))
              }
            />
          )}
          {!!view.errors?.[field.id] && (
            <Text style={styles.error}>{t(view.errors[field.id])}</Text>
          )}
        </View>
      ))}
      {owner && !["submitted", "cancelled"].includes(view.status) && (
        <View style={styles.actions}>
          <Button
            label={t("Save")}
            disabled={disabled}
            action={() => void send("save", { values })}
          />
          <Button
            label={t("Submit form")}
            variant="primary"
            disabled={disabled}
            action={() => void send("submit", { values })}
          />
          <Button
            label={t("Cancel form")}
            disabled={disabled}
            action={() => void send("cancel")}
          />
        </View>
      )}
    </>
  );
}
