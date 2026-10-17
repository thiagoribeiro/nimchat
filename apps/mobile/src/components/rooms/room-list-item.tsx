import { t } from "@nimchat/i18n";
import type { RoomState } from "@nimchat/sdk";
import { router } from "expo-router";
import { Layers, UserPlus } from "lucide-react-native";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { displayRoomName } from "@/components/chat/room-context";
import { Avatar } from "@/components/ui/avatar";
import { CountBadge } from "@/components/ui/status";
import { routes } from "@/lib/routes";
import { colors, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

export interface RoomSummaryRow {
  room: RoomState;
  preview?: string;
  time?: string;
  unread: number;
  surfaceNews: number;
}

export const RoomListItem = memo(function RoomListItem({
  room,
  preview,
  time,
  unread,
  surfaceNews,
}: RoomSummaryRow) {
  const name = displayRoomName(room.name);
  const label = [
    name,
    unread ? t("{count} unread messages", { count: unread }) : "",
    surfaceNews ? t("{count} surfaces with updates", { count: surfaceNews }) : "",
    preview ?? "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        onPress={() => router.push(routes.room(room.room_id))}
      >
        <Avatar name={name} seed={room.room_id} size={44} />
        <View style={styles.body}>
          <View style={styles.line}>
            <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>
              {name}
            </Text>
            {!!time && <Text style={[type.caption, unread > 0 && styles.timeUnread]}>{time}</Text>}
          </View>
          <View style={styles.line}>
            <Text style={[type.caption, styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
              {preview ?? t("No messages yet")}
            </Text>
            {surfaceNews > 0 && (
              <View style={styles.surfaces}>
                <Layers size={13} color={colors.primary} />
                <Text style={styles.surfacesText}>{surfaceNews}</Text>
              </View>
            )}
            <CountBadge count={unread} />
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Invite to {name}", { name })}
        style={styles.invite}
        onPress={() =>
          router.push({ pathname: "/invite", params: { roomId: room.room_id, roomName: room.name } })
        }
      >
        <UserPlus size={18} color={colors.textFaint} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingLeft: space.sm },
  pressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: 12,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  body: { flex: 1, gap: 2 },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.textSecondary },
  nameUnread: { fontFamily: font.semibold, color: colors.text },
  timeUnread: { color: colors.primary },
  preview: { flex: 1 },
  previewUnread: { color: colors.textSecondary },
  surfaces: { flexDirection: "row", alignItems: "center", gap: 3 },
  surfacesText: { fontFamily: font.semibold, fontSize: 12, color: colors.primary },
  invite: { width: touch, height: touch, alignItems: "center", justifyContent: "center" },
});
