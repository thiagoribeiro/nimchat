import { File, Paths } from "expo-file-system";
import type { NimletEvent } from "@nimchat/sdk";

import { NIMLET_URL } from "./nimlet";

const TYPES = new Set([
  "m.ui.message",
  "m.plugin.state.updated",
  "m.plugin.instance.created",
  "m.ui.surface.preference.updated",
  "m.ui.surface.dismissed",
  "m.plugin.command.rejected",
]);
const server = NIMLET_URL;
const namespace = process.env.EXPO_PUBLIC_NIMLET_NAMESPACE ?? "default";
function file(user: string) {
  return new File(
    Paths.document,
    // v2: read positions are room_seq (were global stream positions); old files are ignored.
    "brian-v3-" +
      encodeURIComponent(JSON.stringify([server, namespace, user])) +
      ".json",
  );
}
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
}
// Local cache only: never an authority. Sync rebuilds the projection.
export function loadBrianCache(user: string): LocalBrianState {
  try {
    const f = file(user);
    if (f.exists) {
      const data = JSON.parse(f.textSync());
      if (Array.isArray(data.events) && data.seen) return data;
    }
  } catch {}
  return { events: [], seen: {} };
}
export function saveBrianCache(
  user: string,
  events: NimletEvent[],
  prefs: LocalBrianPrefs,
): void {
  const f = file(user);
  if (!f.exists) f.create();
  f.write(
    JSON.stringify({
      events: events.filter((e) => TYPES.has(e.type)),
      ...prefs,
    }),
  );
}
