import { t } from "@nimchat/i18n";
import { View } from "react-native";
import type { Block } from "@nimchat/brian";
import { Button } from "./button";
import { styles } from "./styles";
import type { PluginViewProps } from "./types";

export function PollView({ view, userId, owner, disabled, send }: PluginViewProps) {
  return (
    <>
      {(view.options ?? []).map((option: Block) => {
        const selected = (
          view.votes_by_user?.[userId] ?? []
        ).includes(option.id);
        return (
          <Button
            key={option.id}
            label={`${selected ? "✓ " : ""}${option.label} (${option.votes ?? 0})`}
            disabled={disabled || view.status !== "open"}
            action={() => {
              const chosen = view.allow_multiple
                ? new Set<string>(view.votes_by_user?.[userId] ?? [])
                : new Set<string>();
              if (selected && view.allow_multiple) chosen.delete(option.id);
              else chosen.add(option.id);
              if (chosen.size)
                void send("vote", { option_ids: [...chosen] });
            }}
          />
        );
      })}
      {owner && view.status === "open" && (
        <View style={styles.actions}>
          <Button
            label={t("Close poll")}
            disabled={disabled}
            action={() => void send("close")}
          />
          <Button
            label={t("Cancel poll")}
            disabled={disabled}
            action={() => void send("cancel")}
          />
        </View>
      )}
    </>
  );
}
