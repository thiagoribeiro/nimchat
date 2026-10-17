import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { useOriginRequest, useRoom } from "@/components/chat/room-context";
import { RoomHeader } from "@/components/chat/room-header";
import { colors } from "@/theme/tokens";

// Aba Mensagens: the default view of a conversation. The composer belongs here
// only; surfaces carry their own controls.
export default function RoomMessagesScreen() {
  const { roomId, name } = useRoom();
  const { focusEvent } = useLocalSearchParams<{ focusEvent?: string }>();
  const request = useOriginRequest((s) => (s.request?.roomId === roomId ? s.request : undefined));
  // A focus view request wins over a deep link's ?focusEvent=.
  const seek = useMemo(
    () =>
      request
        ? { eventId: request.eventId, key: `${request.eventId}:${request.nonce}` }
        : focusEvent
          ? { eventId: focusEvent, key: focusEvent }
          : undefined,
    [request, focusEvent],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <RoomHeader roomId={roomId} name={name} tab="messages" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ChatMessages seek={seek} />
        <ChatInput roomId={roomId} name={name} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
});
