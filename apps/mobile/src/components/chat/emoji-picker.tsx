import { Smile } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/tokens";

// @emoji-mart/react is React-DOM-only (renders <div>/CSS grid) and won't mount in RN's view
// hierarchy — hand-rolled instead, since the web app's own usage is just "grid of native
// emoji, tap to append/react" (no search/categories/skin-tone needed for parity). Same
// onChange(value: string) signature as the web EmojiPicker, so call sites don't change.
const EMOJIS = [
  "👍", "😀", "😂", "😍", "😘", "😜", "😅", "😱", "😎", "🤔",
  "😢", "😡", "🙌", "👏", "🔥", "🎉", "❤️", "💯", "😴", "🤝",
  "👀", "🙏", "😭", "🥳", "🤷", "😬", "🤯", "🥺", "😏", "🫡",
  "✅", "❌", "⭐", "💡", "🚀", "🍕", "☕", "🐶", "🐱", "🎮",
];

export function EmojiPicker({ onChange }: { onChange: (value: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setIsOpen(true)} hitSlop={8}>
        <Smile size={20} color={colors.textMuted} />
      </Pressable>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={EMOJIS}
              numColumns={8}
              keyExtractor={(e) => e}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.cell}
                  onPress={() => {
                    onChange(item);
                    setIsOpen(false);
                  }}
                >
                  <Text style={styles.emoji}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, padding: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  cell: { width: `${100 / 8}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 24 },
});
