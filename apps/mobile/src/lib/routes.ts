import type { Href } from "expo-router";

// Conversation-first routes from UX Spec v2 §6. A surface always lives under
// the room that owns it; deep links resolve through the same paths.
const seg = encodeURIComponent;
export const routes = {
  rooms: "/" as Href,
  room: (roomId: string, focusEvent?: string) =>
    (`/rooms/${seg(roomId)}` + (focusEvent ? `?focusEvent=${seg(focusEvent)}` : "")) as Href,
  surfaces: (roomId: string) => `/rooms/${seg(roomId)}/surfaces` as Href,
  surface: (roomId: string, plugin: string, instanceId: string, from?: "messages" | "surfaces") =>
    (`/rooms/${seg(roomId)}/surfaces/${seg(plugin)}/${seg(instanceId)}` +
      (from ? `?from=${from}` : "")) as Href,
};
