import { File, Paths } from "expo-file-system";
import type { NimletEvent, RoomListEntry } from "@nimchat/sdk";

import { readBrianCache } from "./brian-cache-format";
import type { LocalBrianPrefs, LocalBrianState } from "./brian-cache-format";
import { NIMLET_URL } from "./nimlet";

export type { LocalBrianPrefs, LocalBrianState, PendingCommand } from "./brian-cache-format";

const server = NIMLET_URL;
const namespace = process.env.EXPO_PUBLIC_NIMLET_NAMESPACE ?? "default";
function file(user: string, version: "v3" | "v4") {
  return new File(
    Paths.document,
    // v2: read positions are room_seq (were global stream positions); old files are ignored.
    // v4: the retained timeline of every event type plus the /sync cursor.
    `brian-${version}-` +
      encodeURIComponent(JSON.stringify([server, namespace, user])) +
      ".json",
  );
}
const text = (f: File) => {
  try {
    return f.exists ? f.textSync() : null;
  } catch {
    return null;
  }
};
// Local cache only: never an authority. Sync rebuilds the projection.
export function loadBrianCache(user: string): LocalBrianState {
  return readBrianCache(text(file(user, "v4")), text(file(user, "v3")));
}
// One write for events and cursor: the cursor never gets ahead of the events stored with it.
// Callers pass an already retained (bounded) set of events.
export function saveBrianCache(
  user: string,
  events: NimletEvent[],
  prefs: LocalBrianPrefs,
  cursor?: string,
  rooms?: RoomListEntry[],
): void {
  const f = file(user, "v4");
  if (!f.exists) f.create();
  f.write(JSON.stringify({ events, cursor, rooms, ...prefs }));
  const old = file(user, "v3");
  if (old.exists) old.delete();
}
