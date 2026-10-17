import { t } from "@nimchat/i18n";
import { PersonalSurfaceCreator } from "./personal-surface-creator";
import {
  hasNews,
  pluginLabel,
  surfaceSections,
  surfaceTitle,
} from "@nimchat/brian";
import type { Surface } from "@nimchat/brian";
import { formatDistanceToNowStrict } from "date-fns";
import { dateLocale } from "@/lib/date-locale";
import { router } from "expo-router";
import { ChevronRight, Layers, Pin } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";

import { PluginIcon } from "@/components/ui/plugin-icon";
import { ActivityDot, StatusPill } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/feedback";
import {
  useBrianRead,
  usePendingCommand,
  useRoomEvents,
  useRoomSurfaces,
} from "@/lib/brian";
import { routes } from "@/lib/routes";
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

type Filter = "current" | "archived";

// Surfaces of one conversation (UX Spec v2 §3.2): pinned, active, recent;
// finished and hidden ones stay reachable behind a filter.
export function SurfaceList({ roomId }: { roomId: string }) {
  const { surfaces } = useRoomSurfaces(roomId);
  const events = useRoomEvents(roomId);
  const [filter, setFilter] = useState<Filter>("current");
  const sections = useMemo(
    () => surfaceSections(surfaces, roomId),
    [surfaces, roomId],
  );
  const timeBySeq = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of events) map.set(e.room_seq, e.origin_server_ts);
    return map;
  }, [events]);

  const data =
    filter === "current"
      ? [
          { title: t("Pinned"), data: sections.pinned },
          { title: t("Active"), data: sections.active },
          { title: t("Recent"), data: sections.recent },
        ].filter((s) => s.data.length > 0)
      : sections.archived.length
        ? [{ title: t("Done and hidden"), data: sections.archived }]
        : [];
  const currentCount =
    sections.pinned.length + sections.active.length + sections.recent.length;

  return (
    <View style={styles.page}>
      <PersonalSurfaceCreator roomId={roomId} />
      <View style={styles.filters}>
        <Chip
          label={t("In use ({count})", { count: currentCount })}
          selected={filter === "current"}
          onPress={() => setFilter("current")}
        />
        <Chip
          label={t("Done and hidden ({count})", { count: sections.archived.length })}
          selected={filter === "archived"}
          onPress={() => setFilter("archived")}
        />
      </View>
      <SectionList
        sections={data}
        keyExtractor={(s) => s.key}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text
            style={[type.overline, styles.sectionTitle]}
            accessibilityRole="header"
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <SurfaceRow surface={item} time={timeBySeq.get(item.activity)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Layers size={28} color={colors.textMuted} />}
            title={
              filter === "current"
                ? t("No surfaces in use")
                : t("Nothing done or hidden")
            }
            description={
              filter === "current"
                ? t("Approvals, workflows, forms and lists created in this conversation appear here.")
                : t("Surfaces you finished or hid stay here.")
            }
          />
        }
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SurfaceRow({ surface, time }: { surface: Surface; time?: number }) {
  const news = useBrianRead((s) => hasNews(surface, s.seen));
  const { pending } = usePendingCommand(surface.roomId, surface.block);
  const title = surfaceTitle(surface);
  const label = pluginLabel(surface.block.plugin);
  const ago = time
    ? formatDistanceToNowStrict(time, { locale: dateLocale(), addSuffix: true })
    : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${label}${news ? t(", new activity") : ""}${surface.userPin ? t(", pinned") : ""}`}
      onPress={() =>
        router.push(
          routes.surface(
            surface.roomId,
            surface.block.plugin,
            surface.block.instance_id,
            "surfaces",
          ),
        )
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <PluginIcon plugin={surface.block.plugin} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[type.bodyStrong, styles.flex]} numberOfLines={1}>
            {title}
          </Text>
          {surface.userPin && <Pin size={14} color={colors.textMuted} />}
          <ActivityDot visible={news} />
        </View>
        <Text style={type.caption} numberOfLines={1}>
          {label}
          {ago ? ` · ${ago}` : ""}
          {pending && !pending.rejected ? t(" · waiting for the plugin") : ""}
        </Text>
        <StatusPill view={surface.block.view} />
      </View>
      <ChevronRight size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    padding: space.lg,
    paddingBottom: space.sm,
  },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.textMuted },
  chipTextSelected: { color: colors.text },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    flexGrow: 1,
  },
  sectionTitle: { marginTop: space.lg, marginBottom: space.sm },
  row: {
    minHeight: touch + 24,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    marginBottom: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flexShrink: 1 },
});
