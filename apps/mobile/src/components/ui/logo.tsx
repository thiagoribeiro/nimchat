import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { colors } from "@/theme/tokens";
import { font } from "@/theme/typography";

// NimChat mark: the wave + dot from the brand guide (assets/nimchat-mark.svg).
export function NimMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="w" x1="40" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#3B82F6" />
          <Stop offset="1" stopColor="#8B5CF6" />
        </LinearGradient>
        <LinearGradient id="d" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#6D7CF8" />
          <Stop offset="1" stopColor="#8B5CF6" />
        </LinearGradient>
      </Defs>
      <Path
        d="M66 336 C 116 176, 208 166, 252 252 S 344 346, 372 262"
        fill="none"
        stroke="url(#w)"
        strokeWidth={78}
        strokeLinecap="round"
      />
      <Circle cx={438} cy={176} r={50} fill="url(#d)" />
    </Svg>
  );
}

export function NimLogo({ size = 24 }: { size?: number }) {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="NimChat">
      <NimMark size={size * 1.5} />
      <Text style={[styles.word, { fontSize: size, lineHeight: size * 1.2 }]}>
        nimchat<Text style={styles.dot}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  word: { fontFamily: font.bold, color: colors.text, letterSpacing: -0.5 },
  dot: { color: colors.primary },
});
