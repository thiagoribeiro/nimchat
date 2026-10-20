import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "@nimchat/i18n";
import { messageNotification } from "../src/lib/message-notification.ts";

const base = { type: "message", room_id: "r1", event_id: "e1", sender_name: "Alice", kind: "text", preview: "oi?" };

test("group rooms are titled by the room, with the sender in the body", () => {
  setLocale("en");
  assert.deepEqual(messageNotification({ ...base, room_name: "Family" }), { title: "Family", body: "Alice: oi?", roomId: "r1", eventId: "e1" });
});

test("direct messages are titled by the sender", () => {
  setLocale("en");
  assert.deepEqual(messageNotification({ ...base, room_name: "direct" }), { title: "Alice", body: "oi?", roomId: "r1", eventId: "e1" });
});

test("attachments and cards are labelled in the active locale", () => {
  setLocale("en");
  assert.equal(messageNotification({ ...base, room_name: "direct", kind: "image", preview: "" }).body, "📷 Photo");
  assert.equal(messageNotification({ ...base, room_name: "direct", kind: "file", preview: "bill.pdf" }).body, "📎 bill.pdf");
  assert.equal(messageNotification({ ...base, room_name: "direct", kind: "card", preview: "" }).body, "Interactive card");
  setLocale("pt-BR");
  assert.equal(messageNotification({ ...base, room_name: "direct", kind: "image", preview: "" }).body, "📷 Foto");
  assert.equal(messageNotification({ ...base, room_name: "direct", kind: "card", preview: "" }).body, "Card interativo");
  assert.equal(messageNotification({ ...base, room_name: "direct", sender_name: "" }).title, "Alguém");
  setLocale("en");
});

test("digests and malformed payloads are not message notifications", () => {
  assert.equal(messageNotification({ type: "digest", rooms: "[]" }), null);
  assert.equal(messageNotification({ type: "message", room_id: "r1" }), null);
});
