import { t } from "@nimchat/i18n";
import { NimletError } from "@nimchat/sdk";
import { useLocalSearchParams } from "expo-router";
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
import { colors } from "@/theme/tokens";
import { font } from "@/theme/typography";

export default function InviteScreen() {
  const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName: string }>();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onInvite = async () => {
    if (!roomId || !username) return;
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const client = getNimletClient();
      const user = await client.resolveUsername(username);
      await client.inviteUser(roomId, user.user_id);
      setSuccess(true);
      setUsername("");
    } catch (err) {
      if (err instanceof NimletError && err.status === 404) {
        setError(t('User "{name}" not found in this namespace.', { name: username }));
      } else {
        setError(err instanceof Error ? err.message : t("Could not invite."));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t("Invite to {name}", { name: roomName === "direct" ? t("conversation") : roomName })}
      </Text>
      <Text style={styles.label}>{t("USERNAME")}</Text>
      <TextInput
        style={styles.input}
        placeholder="alice"
        placeholderTextColor={colors.textFaint}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoFocus
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {success && <Text style={styles.success}>{t("Invitation sent!")}</Text>}
      <Pressable
        style={[styles.button, (isLoading || !username) && styles.buttonDisabled]}
        onPress={onInvite}
        disabled={isLoading || !username}
      >
        {isLoading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>{t("Invite")}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, gap: 10 },
  title: { color: colors.text, fontSize: 16, fontFamily: font.bold, marginBottom: 6 },
  label: { color: colors.textMuted, fontSize: 11, fontFamily: font.bold, letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceSunken, color: colors.text, borderRadius: 8, padding: 12, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontSize: 13 },
  button: { backgroundColor: colors.primary, borderRadius: 8, padding: 12, alignItems: "center", marginTop: 6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.text, fontFamily: font.semibold },
});
