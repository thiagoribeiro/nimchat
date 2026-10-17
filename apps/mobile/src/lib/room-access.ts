import { useChatStore } from "@nimchat/sdk";
import { useEffect, useState } from "react";

import { getNimletClient } from "./nimlet";

// Visibility is bounded by room membership (UX Spec v2 §1). A deep link to a
// room or surface only renders after the room list confirms the user joined.
// The server still enforces membership on every request; this avoids showing
// an empty shell or cached data for a room the user cannot open.
export function useRoomAccess(roomId: string): "loading" | "ok" | "denied" {
  const room = useChatStore((s) => s.rooms[roomId]);
  const hydrateRooms = useChatStore((s) => s.hydrateRooms);
  // undefined = not checked yet; true/false = listed by the server or not;
  // null = the room list could not be fetched (offline).
  const [listed, setListed] = useState<boolean | null | undefined>(undefined);
  const known = !!room?.state;

  useEffect(() => {
    if (known) return;
    let cancelled = false;
    setListed(undefined);
    getNimletClient()
      .listRooms()
      .then((res) => {
        if (cancelled) return;
        hydrateRooms(res.rooms);
        setListed(res.rooms.some((r) => r.room_id === roomId));
      })
      .catch(() => !cancelled && setListed(null));
    return () => {
      cancelled = true;
    };
  }, [roomId, known, hydrateRooms]);

  if (room?.state === "join") return "ok";
  if (room?.state) return "denied";
  if (listed === undefined) return "loading";
  // Offline: fall back to rooms this session already knows; the server still
  // rejects history requests for rooms the user is not in.
  if (listed === null) return room ? "ok" : "denied";
  return "denied";
}
