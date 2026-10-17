import { t } from "@nimchat/i18n";
import { isSharedRoom } from "@nimchat/brian";
import { useAuthStore } from "@nimchat/sdk";
import type { RoomState } from "@nimchat/sdk";
import { router } from "expo-router";
import { MoreVertical } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { displayRoomName } from "@/components/chat/room-context";
import { getNimletClient } from "@/lib/nimlet";
import { acceptRoomInvitation } from "@/lib/room-refresh";
import { useSync } from "@/components/providers/sync-provider";
import { routes } from "@/lib/routes";
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

export function InviteInbox({ rooms }: { rooms: RoomState[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const menuTitle = useRef<Text>(null);
  const triggers = useRef(new Map<string, View>());
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const {
    refreshRooms,
    confirmRoomJoined,
    dismissedInvites,
    dismissInvite,
    restoreInvite,
  } = useSync();
  const hidden = rooms.filter((room) => dismissedInvites.has(room.room_id));
  const visible = rooms.filter(
    (room) => showDismissed || !dismissedInvites.has(room.room_id),
  );
  const selected = rooms.find((room) => room.room_id === menuId);
  const focus = (node: Text | View | null | undefined) => {
    if (node) {
      const handle = findNodeHandle(node);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  };
  const closeMenu = () => {
    const trigger = menuId ? triggers.current.get(menuId) : undefined;
    setMenuId(null);
    requestAnimationFrame(() => focus(trigger));
  };
  const accept = async (room: RoomState) => {
    if (busy.current) return;
    closeMenu();
    busy.current = true;
    const userId = useAuthStore.getState().userId;
    const current = () =>
      mounted.current &&
      useAuthStore.getState().isAuthenticated &&
      useAuthStore.getState().userId === userId;
    setPending(room.room_id);
    setError(null);
    try {
      await acceptRoomInvitation(room, {
        join: (id) => getNimletClient().joinRoom(id),
        isCurrentSession: current,
        confirmJoined: confirmRoomJoined,
        open: (id) =>
          router.push(
            (isSharedRoom(room.name)
              ? `/shared/${id}`
              : routes.room(id)) as any,
          ),
        refresh: refreshRooms,
      });
    } catch {
      if (current())
        setError(t("Could not accept the invitation. Try again."));
    } finally {
      busy.current = false;
      if (mounted.current) setPending(null);
    }
  };
  const dismiss = (room: RoomState, restore: boolean) => {
    closeMenu();
    setError(null);
    try {
      if (restore) restoreInvite(room.room_id);
      else dismissInvite(room.room_id);
    } catch {
      setError(
        t("Could not save the preference on this device. Try again."),
      );
    }
  };
  if (!rooms.length) return null;
  return (
    <View style={styles.section}>
      <Text style={type.overline}>
        {t("Invitations received ({count})", { count: rooms.length - hidden.length })}
      </Text>
      {hidden.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowDismissed(!showDismissed)}
          style={styles.restore}
        >
          <Text style={styles.link}>
            {showDismissed
              ? t("Hide dismissed")
              : t("Show invitations dismissed on this device ({count})", { count: hidden.length })}
          </Text>
        </Pressable>
      )}
      {visible.map((room) => (
        <View key={room.room_id} style={styles.card}>
          <View style={styles.body}>
            <Text style={styles.name}>
              {isSharedRoom(room.name)
                ? t("Shared surface")
                : displayRoomName(room.name)}
            </Text>
            <Text style={type.caption}>
              {dismissedInvites.has(room.room_id)
                ? t("Dismissed on this device · invitation still active on the server")
                : t("Invitation to join this room")}
            </Text>
          </View>
          <Pressable
            ref={(node) => {
              if (node) triggers.current.set(room.room_id, node);
              else triggers.current.delete(room.room_id);
            }}
            accessibilityRole="button"
            accessibilityLabel={t("Invitation options for {name}", { name: isSharedRoom(room.name) ? t("Shared surface") : displayRoomName(room.name) })}
            accessibilityState={{
              disabled: pending !== null,
              expanded: menuId === room.room_id,
            }}
            disabled={pending !== null}
            style={[styles.button, pending !== null && styles.disabled]}
            onPress={() => setMenuId(room.room_id)}
          >
            {pending === room.room_id ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <MoreVertical size={22} color={colors.text} />
            )}
          </Pressable>
        </View>
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
        onShow={() => focus(menuTitle.current)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={t("Close invitation options")}
            onPress={closeMenu}
          />
          <View style={styles.menu} accessibilityViewIsModal>
            <Text
              ref={menuTitle}
              accessible
              accessibilityRole="header"
              style={styles.name}
            >
              {selected
                ? isSharedRoom(selected.name)
                  ? t("Shared surface")
                  : displayRoomName(selected.name)
                : t("Invitation")}
            </Text>
            <Text style={type.caption}>
              {t("Dismissing only hides it on this device. The invitation stays on the server and on your other devices.")}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={pending !== null}
              style={styles.action}
              onPress={() => selected && void accept(selected)}
            >
              <Text style={styles.link}>{t("Accept invitation")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={pending !== null}
              style={styles.action}
              onPress={() =>
                selected &&
                dismiss(selected, dismissedInvites.has(selected.room_id))
              }
            >
              <Text style={styles.link}>
                {selected && dismissedInvites.has(selected.room_id)
                  ? t("Restore invitation")
                  : t("Dismiss on this device")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.action}
              onPress={closeMenu}
            >
              <Text style={type.caption}>{t("Cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  body: { flex: 1, gap: 3 },
  name: { color: colors.text, fontFamily: font.semibold, fontSize: 15 },
  button: {
    minHeight: touch,
    minWidth: touch,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: 13 },
  restore: { minHeight: touch, justifyContent: "center" },
  link: { color: colors.primary, fontFamily: font.semibold, fontSize: 14 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  menu: {
    padding: space.lg,
    paddingBottom: 40,
    gap: space.sm,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  action: {
    minHeight: touch,
    padding: space.md,
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
});
