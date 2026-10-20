import { t } from "@nimchat/i18n";

// Formats a per-message push (nimlet namespaces in "message" mode) into the
// notification the device shows. Pure, so it is unit tested without Expo.

export interface MessageNotification {
  title: string;
  body: string;
  roomId: string;
  eventId: string;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

function previewText(kind: string, preview: string): string {
  switch (kind) {
    case "image":
      return preview ? t("📷 {caption}", { caption: preview }) : t("📷 Photo");
    case "file":
      return preview ? t("📎 {name}", { name: preview }) : t("📎 File");
    case "card":
      return preview || t("Interactive card");
    default:
      return preview;
  }
}

// DMs are titled by the sender; group rooms by the room, with "Sender: preview".
export function messageNotification(data: Record<string, unknown>): MessageNotification | null {
  if (data.type !== "message") return null;
  const roomId = text(data.room_id);
  const eventId = text(data.event_id);
  if (!roomId || !eventId) return null;
  const sender = text(data.sender_name) || t("Someone");
  const preview = previewText(text(data.kind), text(data.preview));
  const room = text(data.room_name);
  if (!room || room === "direct") return { title: sender, body: preview, roomId, eventId };
  return { title: room, body: t("{sender}: {preview}", { sender, preview }), roomId, eventId };
}
