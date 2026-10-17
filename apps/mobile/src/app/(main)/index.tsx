import { t } from "@nimchat/i18n";
import { isSharedRoom } from "@nimchat/brian";
import { SharedSurfaces } from "@/components/brian/shared-surfaces";
import { useLocalSearchParams } from "expo-router";
import { hasNews, textContent } from "@nimchat/brian";
import { useAuthStore, useChatStore } from "@nimchat/sdk";
import type {
  AttachmentContent,
  MessageContent,
  NimletEvent,
} from "@nimchat/sdk";
import { format } from "date-fns";
import { router, useFocusEffect } from "expo-router";
import { LogOut, MessageSquare, Plus, Search } from "lucide-react-native";
import { useCallback, useMemo, useState, useEffect } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { displayRoomName } from "@/components/chat/room-context";
import { RoomListItem } from "@/components/rooms/room-list-item";
import { InviteInbox } from "@/components/rooms/invite-inbox";
import type { RoomSummaryRow } from "@/components/rooms/room-list-item";
import { EmptyState, ErrorBanner } from "@/components/ui/feedback";
import { useSync } from "@/components/providers/sync-provider";
import { NimLogo } from "@/components/ui/logo";
import { isSocial, projectRoom, useBrianRead, useTrust } from "@/lib/brian";
import { getNimletClient } from "@/lib/nimlet";
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

function previewOf(e: NimletEvent, me: string | null): string {
  const who = e.sender_id === me ? t("You") : e.sender_display_name;
  let text = "";
  if (e.type === "m.room.message") text = (e.content as MessageContent).body;
  else if (e.type === "m.room.attachment")
    text = `📎 ${(e.content as AttachmentContent).caption || (e.content as AttachmentContent).filename || t("Attachment")}`;
  else text = textContent(e.content);
  return `${who}: ${text.replace(/\s+/g, " ").trim()}`;
}

function timeOf(ts: number): string {
  const date = new Date(ts);
  return new Date().toDateString() === date.toDateString()
    ? format(date, "HH:mm")
    : format(date, t("MM/dd"));
}

export default function RoomListScreen() {
  const rooms = useChatStore((s) => s.rooms);
  const messagesByRoom = useChatStore((s) => s.messagesByRoom);
  const userId = useAuthStore((s) => s.userId);
  const username = useAuthStore((s) => s.username);
  const displayName = useAuthStore((s) => s.displayName);
  const logout = useAuthStore((s) => s.logout);
  const roomSeen = useBrianRead((s) => s.roomSeen);
  const seen = useBrianRead((s) => s.seen);
  const trust = useTrust();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(params.tab === "shared" ? "shared" : "rooms");
  useEffect(() => {
    if (params.tab === "shared") setTab("shared");
  }, [params.tab]);
  const [query, setQuery] = useState("");
  const [showNewMenu, setShowNewMenu] = useState(false);
  const invitations = useMemo(
    () =>
      Object.values(rooms).filter(
        (r) => r.state === "invite" && !isSharedRoom(r.name),
      ),
    [rooms],
  );
  const { refreshRooms, isRefreshingRooms, roomRefreshError } = useSync();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      void refreshRooms().catch(() => {});
    }, [refreshRooms]),
  );

  // Ordered by latest conversation activity. Unread messages and surface news
  // are separate signals (UX Spec v2 §3.4), both computed locally.
  const roomList = useMemo<(RoomSummaryRow & { at: number })[]>(() => {
    const q = query.trim().toLowerCase();
    return Object.values(rooms)
      .filter((r) => r.state === "join" && !isSharedRoom(r.name))
      .filter((r) => !q || displayRoomName(r.name).toLowerCase().includes(q))
      .map((room) => {
        const events = messagesByRoom[room.room_id] ?? [];
        let last: NimletEvent | undefined;
        let unread = 0;
        const readPos = roomSeen[room.room_id] ?? 0;
        for (const e of events) {
          if (!isSocial(e)) continue;
          if (!last || e.room_seq > last.room_seq) last = e;
          if (e.sender_id !== userId && e.room_seq > readPos) unread++;
        }
        let surfaceNews = 0;
        for (const s of projectRoom(events, trust).values())
          if (!s.dismissed && (s.active || s.userPin) && hasNews(s, seen))
            surfaceNews++;
        return {
          room,
          // room_seq only orders within a room; rooms are ranked by time.
          at: last?.origin_server_ts ?? 0,
          preview: last ? previewOf(last, userId) : undefined,
          time: last ? timeOf(last.origin_server_ts) : undefined,
          unread,
          surfaceNews,
        };
      })
      .sort((a, b) => b.at - a.at || a.room.name.localeCompare(b.room.name));
  }, [rooms, messagesByRoom, roomSeen, seen, trust, userId, query]);

  const onLogout = async () => {
    await logout(getNimletClient());
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <NimLogo size={24} />
          <Text style={[type.caption, styles.user]} numberOfLines={1}>
            {displayName ?? username ?? ""}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Log out")}
          onPress={onLogout}
          style={styles.iconButton}
        >
          <LogOut size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 16 }}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "rooms" }}
          style={{ minHeight: 44, justifyContent: "center" }}
          onPress={() => setTab("rooms")}
        >
          <Text style={{ color: colors.text }}>{t("Conversations")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "shared" }}
          style={{ minHeight: 44, justifyContent: "center" }}
          onPress={() => setTab("shared")}
        >
          <Text style={{ color: colors.text }}>{t("Surfaces")}</Text>
        </Pressable>
      </View>
      {tab === "shared" ? (
        <SharedSurfaces />
      ) : (
        <>
          <View style={styles.search}>
            <Search size={16} color={colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("Search conversations")}
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              accessibilityLabel={t("Search conversations")}
              returnKeyType="search"
            />
          </View>

          <Text style={[type.overline, styles.sectionTitle]}>{t("Conversations")}</Text>
          {roomRefreshError && (
            <ErrorBanner
              message={roomRefreshError}
              onAction={() => void refreshRooms().catch(() => {})}
            />
          )}

          <FlatList
            data={roomList}
            ListHeaderComponent={
              invitations.length ? <InviteInbox rooms={invitations} /> : null
            }
            refreshing={isRefreshingRooms}
            onRefresh={() => void refreshRooms().catch(() => {})}
            keyExtractor={(r) => r.room.room_id}
            renderItem={({ item }) => (
              <RoomListItem
                room={item.room}
                preview={item.preview}
                time={item.time}
                unread={item.unread}
                surfaceNews={item.surfaceNews}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon={<MessageSquare size={28} color={colors.textMuted} />}
                title={
                  query
                    ? t("No conversations found")
                    : t("No conversations yet")
                }
                description={
                  query ? undefined : t("Create a room or wait for an invitation.")
                }
              />
            }
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("New conversation")}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + space.lg },
          pressed && styles.pressed,
        ]}
        onPress={() => setShowNewMenu(true)}
      >
        <Plus size={22} color={colors.primaryText} />
        <Text style={styles.fabText}>{t("New conversation")}</Text>
      </Pressable>
      <Modal
        visible={showNewMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewMenu(false)}
      >
        <View style={styles.menuBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={t("Close new conversation options")}
            onPress={() => setShowNewMenu(false)}
          />
          <View style={styles.menuCard}>
            <Text style={[type.heading, styles.menuTitle]}>{t("New conversation")}</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.menuAction}
              onPress={() => {
                setShowNewMenu(false);
                router.push("/new-dm");
              }}
            >
              <Text style={styles.menuActionTitle}>{t("Direct message")}</Text>
              <Text style={type.caption}>
                {t("Talk to someone by username")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.menuAction}
              onPress={() => {
                setShowNewMenu(false);
                router.push("/create-room");
              }}
            >
              <Text style={styles.menuActionTitle}>{t("Create room")}</Text>
              <Text style={type.caption}>
                {t("Bring people and agents into one conversation")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingTop: space.sm,
  },
  brandRow: { flex: 1 },
  user: { marginLeft: 42 },
  iconButton: {
    width: touch,
    height: touch,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    minHeight: touch,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 15,
  },
  sectionTitle: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
  listContent: { paddingRight: space.xs, paddingBottom: 96, flexGrow: 1 },
  fab: {
    position: "absolute",
    right: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    elevation: 4,
  },
  pressed: { opacity: 0.85 },
  fabText: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.primaryText,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  menuCard: {
    backgroundColor: colors.surface,
    padding: space.lg,
    paddingBottom: 40,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: space.sm,
  },
  menuTitle: { marginBottom: space.sm },
  menuAction: {
    padding: space.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: 4,
    minHeight: 72,
    justifyContent: "center",
  },
  menuActionTitle: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 16,
  },
});
