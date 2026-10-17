import { t } from "@nimchat/i18n";
import { ActivityIndicator, Text, View } from "react-native";
import type { usePendingCommand } from "@/lib/brian";
import { ErrorBanner } from "@/components/ui/feedback";
import { colors } from "@/theme/tokens";
import { Button } from "./button";
import { styles } from "./styles";
import type { Send } from "./types";

// Delivery state of the instance's in-flight command.
export function CommandStatus({
  pending,
  error,
  send,
  dismiss,
}: {
  pending: ReturnType<typeof usePendingCommand>["pending"];
  error: string;
  send: Send;
  dismiss: () => void;
}) {
  const sending = pending?.status === "sending";
  const waiting = pending?.status === "queued" || pending?.status === "waiting";
  const failed = pending?.status === "failed";
  const rejected = pending?.rejected;
  return (
    <>
      {(sending || waiting) && (
        <View style={styles.field} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={styles.body}>
            {sending
              ? t("Sending…")
              : pending?.eventId
                ? t("Waiting for the plugin…")
                : t("Delivery not confirmed.")}
          </Text>
        </View>
      )}
      {!!rejected && (
        <ErrorBanner
          message={t("Command refused: {reason}", { reason: t(rejected) })}
          actionLabel={t("Got it")}
          onAction={dismiss}
        />
      )}
      {(!!error || failed) && pending && (
        <ErrorBanner
          message={
            error ||
            pending.error ||
            t("Result not confirmed. Try again with the same command.")
          }
          onAction={() => void send(pending.command, pending.payload, true)}
        />
      )}
      {waiting && !!pending?.eventId && !sending && !error && (
        <Button
          label={t("Check confirmation")}
          action={() => void send(pending!.command, pending!.payload, true)}
        />
      )}
    </>
  );
}
