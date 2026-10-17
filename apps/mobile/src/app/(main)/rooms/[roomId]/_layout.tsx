import { t } from "@nimchat/i18n";
import { useChatStore } from "@nimchat/sdk";
import { Stack, useLocalSearchParams } from "expo-router";
import { Lock } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RoomProvider, useRoomHistoryLoader } from "@/components/chat/room-context";
import { goBackOr } from "@/components/chat/room-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { useRoomAccess } from "@/lib/room-access";
import { routes } from "@/lib/routes";
import { colors } from "@/theme/tokens";

// A deep link straight to a surface still gets the room timeline underneath,
// so back from the focus view lands in the conversation that owns it.
export const unstable_settings = { initialRouteName: "index" };

export default function RoomLayout() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const access = useRoomAccess(roomId);
  const name = useChatStore((s) => s.rooms[roomId]?.name) ?? t("Conversation");
  const history = useRoomHistoryLoader(access === "ok" ? roomId : "");

  if (access !== "ok") {
    return (
      <SafeAreaView style={styles.page}>
        {access === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.center}>
            <EmptyState
              icon={<Lock size={28} color={colors.textMuted} />}
              title={t("No access to this conversation")}
              description={t("You are not in this room, so its messages and surfaces cannot be opened.")}
            />
            <Button label={t("Back to conversations")} onPress={() => goBackOr(routes.rooms)} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <RoomProvider value={{ roomId, name, history }}>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen name="surfaces/index" options={{ animation: "none" }} />
        <Stack.Screen name="surfaces/[plugin]/[instanceId]" options={{ animation: "slide_from_right" }} />
      </Stack>
    </RoomProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
});
