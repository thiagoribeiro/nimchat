import { t } from "@nimchat/i18n";
import { useSync } from "@/components/providers/sync-provider";
import { NimletError, useAuthStore } from "@nimchat/sdk";
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
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

// The Nimlet API supports exact username resolution, not directory search.
// Avoid suggesting autocomplete or listing users outside the current namespace.
export default function NewDmScreen() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const me = useAuthStore((s) => s.userId);
  const { confirmRoomJoined } = useSync();

  const start = async () => {
    const query = username.trim();
    if (!query || loading) return;
    setLoading(true);
    setError("");
    try {
      const client = getNimletClient();
      const person = await client.resolveUsername(query);
      if (person.user_id === me) {
        setError(t("Choose someone else to start a conversation."));
        return;
      }
      const room = await client.getOrCreateDM(person.user_id);
      confirmRoomJoined(room);
      router.replace(routes.room(room.room_id));
    } catch (err) {
      if (err instanceof NimletError && err.status === 404) {
        setError(
          t("User not found in this namespace. Check the exact name."),
        );
      } else {
        setError(t("Could not start the conversation. Try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={type.heading}>{t("Talk to someone")}</Text>
      <Text style={type.caption}>
        {t("Type the exact username. Nimlet does not offer partial search yet.")}
      </Text>
      <Text style={[type.overline, styles.label]}>{t("USERNAME")}</Text>
      <TextInput
        value={username}
        onChangeText={(value) => {
          setUsername(value);
          setError("");
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => void start()}
        placeholder={t("e.g. maria")}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={t("Username for direct message")}
        style={styles.input}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Start direct message")}
        disabled={!username.trim() || loading}
        style={[
          styles.button,
          (!username.trim() || loading) && styles.disabled,
        ]}
        onPress={() => void start()}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>{t("Start conversation")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.background,
  },
  label: { marginTop: space.md },
  input: {
    minHeight: touch,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger, fontFamily: font.medium, fontSize: 14 },
  button: {
    minHeight: touch + 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  disabled: { opacity: 0.55 },
  buttonText: {
    color: colors.primaryText,
    fontFamily: font.semibold,
    fontSize: 15,
  },
});
