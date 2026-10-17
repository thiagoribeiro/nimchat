import { StyleSheet } from "react-native";
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

// Styles shared by the BRIAN block views.
export const styles = StyleSheet.create({
  card: {
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  focusCard: { marginTop: 0, padding: space.lg },
  title: { ...type.heading },
  body: { ...type.body },
  notice: {
    borderLeftWidth: 3,
    borderColor: colors.warning,
    backgroundColor: colors.surfaceRaised,
    padding: space.sm,
    borderRadius: radius.sm,
  },
  error: { ...type.label, color: colors.danger },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flexWrap: "wrap",
    minHeight: touch,
  },
  formField: { gap: 6 },
  input: {
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 15,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    minHeight: touch,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space.sm,
  },
  steps: { gap: space.sm },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  step: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginTop: 4,
  },
  stepText: { flex: 1 },
});
