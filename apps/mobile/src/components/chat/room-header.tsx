import { t, tn } from "@nimchat/i18n";
import { hasNews, surfaceSections } from "@nimchat/brian";
import { router } from "expo-router";
import { ChevronLeft, UserRoundPlus } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { CountBadge } from "@/components/ui/status";
import { displayRoomName } from "@/components/chat/room-context";
import { useBrianRead, useRoomSurfaces } from "@/lib/brian";
import { routes } from "@/lib/routes";
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

export function goBackOr(href: Parameters<typeof router.replace>[0]) {
  if (router.canGoBack()) router.back();
  else router.replace(href);
}

export function RoomHeader({
  roomId,
  name,
  tab,
}: {
  roomId: string;
  name: string;
  tab: "messages" | "surfaces";
}) {
  const { surfaces } = useRoomSurfaces(roomId);
  const seen = useBrianRead((s) => s.seen);
  // Badge counts news only on surfaces in use, matching the "Em uso" list;
  // finished or hidden ones never nag.
  const { active, news } = useMemo(() => {
    const sections = surfaceSections(surfaces, roomId);
    const inUse = [...sections.pinned, ...sections.active, ...sections.recent];
    return {
      active: sections.pinned.length + sections.active.length,
      news: inUse.filter((s) => hasNews(s, seen)).length,
    };
  }, [surfaces, roomId, seen]);
  const title = displayRoomName(name);

  // Tabs are peers: replace instead of push so back always leaves the room.
  const select = (next: "messages" | "surfaces") => {
    if (next === tab) return;
    router.replace(next === "messages" ? routes.room(roomId) : routes.surfaces(roomId));
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Back to conversations")}
          onPress={() => goBackOr(routes.rooms)}
          style={styles.back}
        >
          <ChevronLeft size={24} color={colors.textSecondary} />
        </Pressable>
        <Avatar name={title} seed={roomId} size={36} />
        <View style={styles.titles}>
          <Text style={type.heading} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {active > 0
              ? tn(active, "{count} active surface", "{count} active surfaces")
              : t("Conversation")}
          </Text>
        </View>
        {name !== "direct" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Invite a person to {name}", { name: title })}
            accessibilityHint={t("Opens the form to invite by username")}
            onPress={() => router.push({
              pathname: "/invite",
              params: { roomId, roomName: name },
            })}
            style={styles.invite}
          >
            <UserRoundPlus size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        <Tab label={t("Messages")} selected={tab === "messages"} onPress={() => select("messages")} />
        <Tab
          label={t("Surfaces")}
          selected={tab === "surfaces"}
          onPress={() => select("surfaces")}
          badge={news}
        />
      </View>
    </View>
  );
}

function Tab({
  label,
  selected,
  onPress,
  badge = 0,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={badge ? t("{label}, {count} with updates", { label, count: badge }) : label}
      onPress={onPress}
      style={[styles.tab, selected && styles.tabSelected]}
    >
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
      <CountBadge count={badge} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.xs,
    paddingTop: space.xs,
  },
  back: { width: touch, height: touch, alignItems: "center", justifyContent: "center" },
  titles: { flex: 1, marginRight: space.sm },
  invite: { width: touch, height: touch, alignItems: "center", justifyContent: "center", marginRight: space.xs },
  tabs: {
    flexDirection: "row",
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.sm + 2,
  },
  tabSelected: { backgroundColor: colors.surfaceRaised },
  tabText: { fontFamily: font.medium, fontSize: 14, color: colors.textMuted },
  tabTextSelected: { color: colors.text, fontFamily: font.semibold },
});
