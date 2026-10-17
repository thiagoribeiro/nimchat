import {
  Bot,
  ClipboardList,
  Layers,
  ListChecks,
  ShieldCheck,
  Vote,
  Workflow,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { brand, colors, radius } from "@/theme/tokens";

const icons = {
  approval: ShieldCheck,
  workflow: Workflow,
  checklist: ListChecks,
  poll: Vote,
  form_stateful: ClipboardList,
  agent_status: Bot,
} as const;

export function PluginIcon({ plugin, size = 40 }: { plugin: string; size?: number }) {
  const Icon = icons[plugin as keyof typeof icons] ?? Layers;
  return (
    <View
      style={[styles.box, { width: size, height: size, borderRadius: size > 32 ? radius.md : radius.sm }]}
      importantForAccessibility="no-hide-descendants"
    >
      <Icon size={size * 0.5} color={brand.lavender} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
});
