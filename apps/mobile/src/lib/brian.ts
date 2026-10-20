import { usePluginCommands } from "./plugin-commands";
import { create } from "zustand";
import {
  authoritativeRejection,
  instanceKey,
  project,
  surfacePins,
} from "@nimchat/brian";
import type { Block, Surface, Trust } from "@nimchat/brian";
import { useEffect } from "react";
import { loadBrianCache, saveBrianCache } from "./brian-cache";
import type { PendingCommand } from "./brian-cache";
import {
  cachedRooms,
  retainTimeline,
  useAuthStore,
  useChatStore,
} from "@nimchat/sdk";
import type { NimletEvent } from "@nimchat/sdk";

export type { PendingCommand } from "./brian-cache";

// Pin concrete service IDs at build/deployment time. Display names are not an authority.
const ids = (s: string | undefined) =>
  new Set(
    (s ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
export function brianTrust(userId: string): Trust {
  return {
    userId,
    publishers: ids(process.env.EXPO_PUBLIC_BRIAN_PUBLISHER_IDS),
    agents: ids(process.env.EXPO_PUBLIC_BRIAN_AGENT_IDS),
  };
}
// Stable Trust per user so memoized projections and effects don't churn.
const trusts = new Map<string, Trust>();
export function trustFor(userId: string): Trust {
  let trust = trusts.get(userId);
  if (!trust) {
    trust = brianTrust(userId);
    trusts.set(userId, trust);
  }
  return trust;
}
export function useTrust(): Trust {
  return trustFor(useAuthStore((s) => s.userId) ?? "");
}

const EMPTY_EVENTS: NimletEvent[] = [];
export function useRoomEvents(roomId: string): NimletEvent[] {
  return useChatStore((s) => s.messagesByRoom[roomId]) ?? EMPTY_EVENTS;
}
// One projection per room event array, shared by the timeline rows, the
// surface list and the focus view instead of being recomputed per message.
const projections = new WeakMap<
  readonly NimletEvent[],
  { user: string; surfaces: Map<string, Surface> }
>();
export function projectRoom(
  events: readonly NimletEvent[],
  trust: Trust,
): Map<string, Surface> {
  const hit = projections.get(events);
  if (hit && hit.user === trust.userId) return hit.surfaces;
  const surfaces = project(events, trust);
  projections.set(events, { user: trust.userId, surfaces });
  return surfaces;
}
export function useRoomSurfaces(roomId: string): {
  surfaces: Map<string, Surface>;
  trust: Trust;
} {
  const trust = useTrust();
  const events = useRoomEvents(roomId);
  return { surfaces: projectRoom(events, trust), trust };
}

const SOCIAL_TYPES = new Set([
  "m.room.message",
  "m.room.attachment",
  "m.ui.message",
]);
export const isSocial = (e: NimletEvent) => SOCIAL_TYPES.has(e.type);

interface LocalState {
  // Surface read positions (key = instanceKey) — UX Spec v2 §3.4.
  seen: Record<string, number>;
  // Timeline read positions per room; a separate signal from surface activity.
  roomSeen: Record<string, number>;
  expanded: Record<string, boolean>;
  // Commands awaiting an authoritative state update, keyed by instanceKey. Kept
  // across navigation and restarts so a retry reuses the same transaction id.
  pending: Record<string, PendingCommand>;
  // /sync cursor covered by the events in the store; persisted with them.
  cursor?: string;
  user: string;
  initialize: (user: string) => void;
  noteCursor: (cursor: string) => void;
  flush: () => void;
  // Logout: drop the cached timeline and cursor, keep the prefs, stop writing.
  forget: () => void;
  expand: (key: string, value: boolean) => void;
  mark: (key: string, pos: number) => void;
  markRoom: (roomId: string, pos: number) => void;
  baselineRooms: (events: NimletEvent[]) => void;
  setPending: (key: string, value: PendingCommand | null) => void;
  retainRooms: (joined: ReadonlySet<string>) => void;
  persist: () => void;
}
let timer: ReturnType<typeof setTimeout> | undefined;
// Writes a bounded slice of the timeline (see retainTimeline) with the cursor it covers.
// `prefsOnly` (logout) drops timeline, rooms and cursor and keeps the local prefs.
function write(
  s: Pick<LocalState, "user" | "seen" | "roomSeen" | "expanded" | "pending" | "cursor">,
  prefsOnly = false,
) {
  if (!s.user) return;
  const chat = useChatStore.getState();
  try {
    saveBrianCache(
      s.user,
      prefsOnly
        ? []
        : retainTimeline(chat.messagesByRoom, { pin: surfacePins(trustFor(s.user)) }),
      {
        seen: s.seen,
        roomSeen: s.roomSeen,
        expanded: s.expanded,
        pending: s.pending,
      },
      prefsOnly ? undefined : s.cursor,
      prefsOnly ? [] : cachedRooms(chat.rooms),
    );
  } catch (err) {
    console.warn("Could not save the BRIAN cache", err);
  }
}
export const useBrianRead = create<LocalState>((set, get) => ({
  seen: {},
  roomSeen: {},
  expanded: {},
  pending: {},
  user: "",
  initialize: (user) => {
    clearTimeout(timer);
    const cache = loadBrianCache(user);
    set({
      seen: cache.seen,
      roomSeen: cache.roomSeen ?? {},
      expanded: cache.expanded ?? {},
      pending: cache.pending ?? {},
      cursor: cache.cursor,
      user,
    });
    if (cache.rooms?.length)
      useChatStore.getState().hydrateRooms(cache.rooms, false);
    useChatStore.getState().applyEvents(cache.events);
  },
  // Called right after the batch it came with is applied, so it never runs ahead of it.
  noteCursor: (cursor) => {
    set({ cursor });
    get().persist();
  },
  flush: () => {
    clearTimeout(timer);
    write(get());
  },
  forget: () => {
    clearTimeout(timer);
    const s = get();
    write(s, true);
    set({ user: "", cursor: undefined });
  },
  expand: (key, value) => {
    set((s) => ({ expanded: { ...s.expanded, [key]: value } }));
    get().persist();
  },
  mark: (key, pos) => {
    if ((get().seen[key] ?? 0) >= pos) return;
    set((s) => ({ seen: { ...s.seen, [key]: pos } }));
    get().persist();
  },
  markRoom: (roomId, pos) => {
    if ((get().roomSeen[roomId] ?? 0) >= pos) return;
    set((s) => ({ roomSeen: { ...s.roomSeen, [roomId]: pos } }));
    get().persist();
  },
  // The first sync after a fresh install replays history; treat it as read so
  // every room doesn't light up at once. Rooms seen later start unread.
  baselineRooms: (events) => {
    const roomSeen = { ...get().roomSeen };
    let changed = false;
    for (const e of events) {
      if (!isSocial(e) || (roomSeen[e.room_id] ?? 0) >= e.room_seq) continue;
      roomSeen[e.room_id] = e.room_seq;
      changed = true;
    }
    if (!changed) return;
    set({ roomSeen });
    get().persist();
  },
  setPending: (key, value) => {
    set((s) => {
      const pending = { ...s.pending };
      if (value) pending[key] = value;
      else delete pending[key];
      return { pending };
    });
    get().persist();
  },
  retainRooms: (joined) => {
    const belongs = (key: string) => {
      try {
        return joined.has(JSON.parse(key)[0]);
      } catch {
        return false;
      }
    };
    const keep = <T>(values: Record<string, T>) =>
      Object.fromEntries(
        Object.entries(values).filter(([key]) => belongs(key)),
      );
    const { seen, expanded, roomSeen } = get();
    set({
      seen: keep(seen),
      expanded: keep(expanded),
      roomSeen: Object.fromEntries(
        Object.entries(roomSeen).filter(([room]) => joined.has(room)),
      ),
      pending: {},
    });
    get().persist();
  },
  persist: () => {
    clearTimeout(timer);
    timer = setTimeout(() => write(get()), 500);
  },
}));

// Resolves a pending command against the event stream: an authoritative
// rejection, a higher view revision or a state update naming the command.
// Mounted wherever the pending state is shown, so it clears even when the
// update arrives while the focus view is closed.
export function usePendingCommand(roomId: string, block: Block) {
  const key = instanceKey(roomId, block.plugin ?? "", block.instance_id ?? "");
  const pending = usePluginCommands((s) => s.pending[key]);
  return {
    key,
    pending: pending
      ? {
          ...pending,
          rejected: pending.status === "rejected" ? pending.error : undefined,
        }
      : undefined,
  };
}
