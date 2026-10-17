import { t } from "@nimchat/i18n";
import { useAuthStore } from "@nimchat/sdk";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getNimletClient } from "@/lib/nimlet";
import { NimMark } from "@/components/ui/logo";
import { colors, radius, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const client = getNimletClient();
      if (mode === "login") {
        await login(client, { username, password, device_name: "android" });
      } else {
        await register(client, {
          username,
          password,
          display_name: displayName || username,
          device_name: "android",
        });
      }
      router.replace("/(main)");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Something went wrong. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View style={styles.brand}>
            <NimMark size={88} />
            <Text style={styles.word} accessibilityRole="header">
              nimchat<Text style={styles.dot}>.</Text>
            </Text>
            <Text style={[type.body, styles.tagline]}>
              {mode === "login" ? t("Conversations that do more.") : t("Create your account")}
            </Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder={t("login::Username")}
            placeholderTextColor={colors.textFaint}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="username"
          />
          {mode === "register" && (
            <TextInput
              style={styles.input}
              placeholder={t("Display name")}
              placeholderTextColor={colors.textFaint}
              value={displayName}
              onChangeText={setDisplayName}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder={t("Password")}
            placeholderTextColor={colors.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={isSubmitting || !username || !password}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>{mode === "login" ? t("Log in") : t("Create account")}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
            <Text style={styles.switchMode}>
              {mode === "login" ? t("No account? Create one") : t("Already have an account? Log in")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  form: { width: "100%", maxWidth: 360, gap: 12 },
  brand: { alignItems: "center", marginBottom: 16 },
  word: { fontFamily: font.bold, fontSize: 34, color: colors.text, letterSpacing: -1 },
  dot: { color: colors.primary },
  tagline: { color: colors.textMuted, marginTop: 4 },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: touch,
    fontFamily: font.regular,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: touch,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.text, fontFamily: font.semibold },
  switchMode: { color: colors.link, fontFamily: font.medium, fontSize: 14, textAlign: "center", padding: 12 },
});
