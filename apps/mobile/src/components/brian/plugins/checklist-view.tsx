import { t } from "@nimchat/i18n";
import { Switch, Text, View } from "react-native";
import type { Block } from "@nimchat/brian";
import { colors } from "@/theme/tokens";
import { Button } from "./button";
import { styles } from "./styles";
import type { PluginViewProps } from "./types";

export function ChecklistView({ view, owner, disabled, send }: PluginViewProps) {
  return (
    <>
      {(view.items ?? []).map((item: Block) => (
        <View key={item.id} style={styles.field}>
          <Switch
            trackColor={{
              true: colors.primary,
              false: colors.borderStrong,
            }}
            thumbColor={colors.text}
            accessibilityLabel={item.label}
            value={!!item.checked}
            disabled={
              disabled || !["open", "completed"].includes(view.status)
            }
            onValueChange={(checked) =>
              void send(checked ? "check_item" : "uncheck_item", {
                item_id: item.id,
              })
            }
          />
          <Text style={styles.body}>{item.label}</Text>
        </View>
      ))}
      {owner && ["open", "completed"].includes(view.status) && (
        <View style={styles.actions}>
          <Button
            label={t("Archive")}
            disabled={disabled}
            action={() => void send("archive")}
          />
          <Button
            label={t("Cancel list")}
            disabled={disabled}
            action={() => void send("cancel")}
          />
        </View>
      )}
    </>
  );
}
