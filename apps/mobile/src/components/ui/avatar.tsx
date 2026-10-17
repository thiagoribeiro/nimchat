import { StyleSheet, Text, View } from "react-native";

import { brand } from "@/theme/tokens";
import { font } from "@/theme/typography";

const palette = [brand.violet, brand.blue, brand.cyan, brand.mint, brand.lavender];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, seed, size = 40 }: { name: string; seed?: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9\u00C0-\u024F]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "#";
  const color = palette[hash(seed ?? name) % palette.length];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + "33" }]}
    >
      <Text style={[styles.text, { color, fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  text: { fontFamily: font.semibold },
});
