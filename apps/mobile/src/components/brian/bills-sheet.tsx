import { t } from "@nimchat/i18n";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";
export function BillsSheet({
  open,
  title,
  close,
  children,
}: {
  open: boolean;
  title: string;
  close(): void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel={t("Close panel")}
          onPress={close}
        />
        <View
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
          accessibilityViewIsModal
          importantForAccessibility="yes"
        >
          <View style={s.header}>
            <Text style={s.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Close panel")}
              style={s.close}
              onPress={close}
            >
              <Text style={s.x}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#0009", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    paddingVertical: 14,
  },
  close: {
    minHeight: 48,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  x: { fontSize: 28, color: colors.text },
  content: { padding: 20, gap: 14 },
});
