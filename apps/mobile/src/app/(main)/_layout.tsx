import { t } from "@nimchat/i18n";
import { Stack } from "expo-router";

import { AuthGate } from "@/components/auth-gate";
import { colors } from "@/theme/tokens";
import { font } from "@/theme/typography";

// Deep links into a room keep the conversation list underneath.
export const unstable_settings = { initialRouteName: "index" };

const modal = {
  presentation: "modal" as const,
  headerShown: true,
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontFamily: font.semibold },
};

export default function MainLayout() {
  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="rooms/[roomId]" />
        <Stack.Screen name="create-room" options={{ ...modal, title: t("New room") }} />
        <Stack.Screen name="new-dm" options={{ ...modal, title: t("New direct message") }} />
        <Stack.Screen name="invite" options={{ ...modal, title: t("Invite") }} />
      </Stack>
    </AuthGate>
  );
}
