import { t } from "@nimchat/i18n";
import { useSync } from "@/components/providers/sync-provider";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getNimletClient } from "@/lib/nimlet";
import { routes } from "@/lib/routes";
import { colors } from "@/theme/tokens";
import { font } from "@/theme/typography";

export default function CreateRoomScreen() {
  const { confirmRoomJoined } = useSync();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name) return;
    setIsLoading(true);
    setError(null);
    try {
      const room = await getNimletClient().createRoom({ name });
      confirmRoomJoined(room);
      router.replace(routes.room(room.room_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to create room"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t("ROOM NAME")}</Text>
      <TextInput
        style={styles.input}
        placeholder="general"
        placeholderTextColor={colors.textFaint}
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
        autoFocus
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={[styles.button, (isLoading || !name) && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={isLoading || !name}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.buttonText}>{t("Create room")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 10,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surfaceSunken,
    color: colors.text,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  error: { color: colors.danger, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.text, fontFamily: font.semibold },
});
