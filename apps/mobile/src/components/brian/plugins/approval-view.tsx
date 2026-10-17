import { t, locale } from "@nimchat/i18n";
import { Text, View } from "react-native";
import { Button } from "./button";
import { styles } from "./styles";
import type { PluginViewProps } from "./types";

export function ApprovalView({ view, owner, disabled, send }: PluginViewProps) {
  const expired = Date.parse(view.expires_at) <= Date.now();
  return (
    <>
      <Text style={styles.body}>
        {view.expires_at
          ? t("Deadline: {date}", { date: new Date(view.expires_at).toLocaleString(locale()) })
          : ""}
      </Text>
      {view.status === "pending" && !expired && owner ? (
        <View style={styles.actions}>
          <Button
            label={t("Approve")}
            variant="primary"
            disabled={disabled}
            action={() => void send("approve")}
          />
          <Button
            label={t("Reject")}
            variant="danger"
            disabled={disabled}
            action={() => void send("reject")}
          />
          <Button
            label={t("Cancel request")}
            disabled={disabled}
            action={() => void send("cancel")}
          />
        </View>
      ) : view.status === "pending" && !owner ? (
        <Text style={styles.body}>{t("Waiting for the requester.")}</Text>
      ) : null}
    </>
  );
}
