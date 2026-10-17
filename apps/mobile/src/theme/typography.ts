// Per-weight imports so only the four weights in use are bundled.
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import type { TextStyle } from "react-native";

import { colors } from "./tokens";

export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

// Android ignores fontWeight for custom fonts, so each weight is its own family.
export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const type = {
  title: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, color: colors.text },
  heading: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  bodyStrong: { fontFamily: font.semibold, fontSize: 15, lineHeight: 22, color: colors.text },
  label: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  overline: {
    fontFamily: font.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
} satisfies Record<string, TextStyle>;
