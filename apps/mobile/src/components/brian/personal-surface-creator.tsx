import { t, timeZone } from "@nimchat/i18n";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { v4 as uuid } from "uuid";
import { getNimletClient } from "@/lib/nimlet";
import { Button } from "@/components/ui/button";
import { colors } from "@/theme/tokens";
import { useAuthStore, useChatStore } from "@nimchat/sdk";
import { brianTrust } from "@/lib/brian";
export function PersonalSurfaceCreator({ roomId }: { roomId: string }) {
  const user = useAuthStore((s) => s.userId) ?? "";
  const events = useChatStore((s) => s.messagesByRoom[roomId]);
  const trust = brianTrust(user);
  const integrated = events?.some(
    (e) => trust.agents.has(e.sender_id) || trust.publishers.has(e.sender_id),
  );
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(t("Household bills")),
    [message, setMessage] = useState("");
  if (
    process.env.EXPO_PUBLIC_BRIAN_MONTHLY_BILLS_ENABLED !== "true" ||
    !integrated
  )
    return null;
  return (
    <View style={{ padding: 12, gap: 8 }}>
      <Button
        label={t("Create monthly bills in this conversation")}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <TextInput
            accessibilityLabel={t("Monthly bills name")}
            style={{
              color: colors.text,
              minHeight: 44,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 8,
            }}
            value={title}
            onChangeText={setTitle}
          />
          <Button
            label={t("Create")}
            disabled={!title.trim()}
            onPress={async () => {
              try {
                await getNimletClient().sendEvent(
                  roomId,
                  "m.plugin.command",
                  uuid(),
                  {
                    plugin: "monthly_bills",
                    instance_id: "create:" + uuid(),
                    command: "create_personal",
                    payload: { title, data: { timezone: timeZone() } },
                  },
                );
                setMessage(
                  t("Creation requested. Wait for the plugin to confirm it."),
                );
              } catch {
                setMessage(t("Could not request creation."));
              }
            }}
          />
        </>
      )}
      {!!message && <Text style={{ color: colors.text }}>{message}</Text>}
    </View>
  );
}
