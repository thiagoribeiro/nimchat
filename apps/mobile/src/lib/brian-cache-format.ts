import type { NimletEvent, RoomListEntry } from "@nimchat/sdk";

export interface PendingCommand {
  txn: string;
  eventId?: string;
  revision: number;
  command: string;
  payload: Record<string, unknown>;
  // Authoritative rejection reason, shown until the user dismisses or retries.
  rejected?: string;
}
export interface LocalBrianPrefs {
  seen: Record<string, number>;
  roomSeen?: Record<string, number>;
  expanded?: Record<string, boolean>;
  pending?: Record<string, PendingCommand>;
}
export interface LocalBrianState extends LocalBrianPrefs {
  events: NimletEvent[];
  // /sync cursor, written in the same file as the events it covers.
  cursor?: string;
  // Last room list: names and membership before GET /rooms answers, or offline.
  rooms?: RoomListEntry[];
}

const parse = (text: string | null): any => {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

// v4 holds the retained timeline (all event types) and the /sync cursor. A v3 file (BRIAN
// events and prefs, no cursor) still provides the prefs once; its events are kept too, and
// the missing cursor means one full replay.
export function readBrianCache(v4: string | null, v3: string | null): LocalBrianState {
  for (const data of [parse(v4), parse(v3)]) {
    if (!data || !Array.isArray(data.events) || !data.seen) continue;
    return {
      ...data,
      cursor: typeof data.cursor === "string" ? data.cursor : undefined,
      rooms: Array.isArray(data.rooms) ? data.rooms : undefined,
    };
  }
  return { events: [], seen: {} };
}
