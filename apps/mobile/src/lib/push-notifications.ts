import { t, tn } from "@nimchat/i18n";
import type { NimletClient } from "@nimchat/sdk";
import * as Notifications from "expo-notifications";

export const BACKGROUND_NOTIFICATION_TASK = "NIMCHAT_PUSH_DIGEST_TASK";

interface RoomDigestPayload {
  room_id: string;
  room_name: string;
  count: number;
}

// Everything this app pushes is data-only (see backend's push.Digest/fcm.Sender) —
// the OS never auto-shows anything for it, so this handler only matters if some
// future notification type doesn't go through our own display logic below.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// The FCM data payload arrives flat (data.type/data.rooms/...) via the foreground
// listener, but expo-notifications' background-task payload docs describe an
// alternate `dataString`-wrapped shape — this normalizes either into the same flat
// record so showDigestNotifications doesn't need to care which path it came from.
function extractDigestFields(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.dataString === "string") {
    try {
      return { ...raw, ...JSON.parse(raw.dataString) };
    } catch {
      // fall through to the raw fields below
    }
  }
  return raw;
}

// The backend stores "direct" as a placeholder room name for DMs (see usecase.GetOrCreateDM
// in the Go backend) — every other screen (room-list-item.tsx, chat-messages.tsx) already
// swaps it for something readable before displaying; the push digest needs the same swap.
function displayRoomName(name: string): string {
  return name === "direct" ? t("Direct Message") : name;
}

async function showDigestNotifications(raw: Record<string, unknown>) {
  const data = extractDigestFields(raw);
  if (data.type !== "digest" || typeof data.rooms !== "string") return;

  let rooms: RoomDigestPayload[];
  try {
    rooms = JSON.parse(data.rooms);
  } catch {
    return;
  }
  if (rooms.length === 0) return;

  // expo-notifications' cross-platform API doesn't expose Android's native
  // setGroup()/setGroupSummary() stacking, so N separate room cards isn't
  // available — a single room gets a direct, tappable notification; multiple
  // rooms collapse into one combined summary instead of spamming N cards.
  if (rooms.length === 1) {
    const room = rooms[0];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: displayRoomName(room.room_name),
        body: tn(room.count, "{count} new message", "{count} new messages"),
        data: { roomId: room.room_id },
      },
      trigger: null,
    });
    return;
  }

  const totalCount = rooms.reduce((sum, r) => sum + r.count, 0);
  const summary = rooms.map((r) => `${displayRoomName(r.room_name)}: ${r.count}`).join(", ");
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "NimChat",
      body: t("{count} new messages — {summary}", { count: totalCount, summary }),
      data: {}, // no roomId: tap opens the room list (see setupNotificationTapListener)
    },
    trigger: null,
  });
}

// Called while the JS app is running (foreground or backgrounded-but-alive).
export function setupForegroundDigestListener() {
  return Notifications.addNotificationReceivedListener((notification) => {
    void showDigestNotifications(notification.request.content.data ?? {});
  });
}

// Called by index.js's headless TaskManager task when the app is backgrounded or
// fully killed — same display logic, different entry point.
export async function handleBackgroundNotificationTaskPayload(data: Record<string, unknown>) {
  await showDigestNotifications(data);
}

export function setupNotificationTapListener(onOpenRoom: (roomId: string) => void, onOpenRoomList: () => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const roomId = response.notification.request.content.data?.roomId;
    if (typeof roomId === "string") {
      onOpenRoom(roomId);
    } else {
      onOpenRoomList();
    }
  });
}

// Requests permission (if not already granted/denied) and registers the device's
// raw FCM token with the backend. Safe to call repeatedly (e.g. on every login) —
// SetPushToken is a plain overwrite server-side.
export async function registerForPushNotificationsAsync(client: NimletClient): Promise<void> {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return;

  const token = await Notifications.getDevicePushTokenAsync();
  if (token.type !== "android") return; // this app is Android-only, see the plan
  await client.setPushToken(token.data);
}
