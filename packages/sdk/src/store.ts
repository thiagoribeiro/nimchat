import { create } from "zustand";
import type {
  NimletEvent,
  ReactionContent,
  RoomListEntry,
  RoomSummary,
} from "./types";

export interface RoomState {
  room_id: string;
  name: string;
  join_rule?: string;
  state?: RoomListEntry["state"]; // present once hydrated via GET /rooms; absent for a room
  role?: string; // just created/joined this session and not yet re-listed.
  lastEvent?: NimletEvent;
}

interface ChatState {
  deniedRooms: Record<string, true>;
  continuationByRoom: Record<string, string>;
  continuationReferenceByRoom: Record<string, Record<string, unknown>>;
  setContinuation: (room: string, parent?: string, reference?: Record<string, unknown>) => void;
  rooms: Record<string, RoomState>;
  messagesByRoom: Record<string, NimletEvent[]>;
  reset: () => void;
  upsertRoom: (room: RoomSummary) => void;
  hydrateRooms: (rooms: RoomListEntry[], complete?: boolean) => void;
  setInitialMessages: (roomId: string, events: NimletEvent[]) => void;
  applyEvents: (events: NimletEvent[]) => void;
}

// Normalized client-side state fed by SyncEngine (real-time) and getMessages (pagination).
// Deliberately dumb: it appends/stores whatever the server sends, no business logic about
// what event types mean — same "server doesn't need to understand every event type"
// philosophy as Nimlet itself, pushed down to the client's core state.
export const useChatStore = create<ChatState>((set) => ({
  continuationByRoom: {},
  continuationReferenceByRoom: {},
  setContinuation: (room, parent, reference) =>
    set((s) => {
      const next = { ...s.continuationByRoom };
      if (parent) next[room] = parent;
      else delete next[room];
      const refs = { ...s.continuationReferenceByRoom };
      if (parent && reference) refs[room] = reference;
      else delete refs[room];
      return { continuationByRoom: next, continuationReferenceByRoom: refs };
    }),
  deniedRooms: {},
  rooms: {},
  messagesByRoom: {},
  reset: () =>
    set({
      rooms: {},
      messagesByRoom: {},
      deniedRooms: {},
      continuationByRoom: {},
      continuationReferenceByRoom: {},
    }),

  upsertRoom: (room) =>
    set((state) => ({
      rooms: {
        ...state.rooms,
        [room.room_id]: { ...state.rooms[room.room_id], ...room },
      },
    })),

  // Feeds GET /rooms into the store — the sidebar's primary data source on load, since
  // rooms created/joined in a *previous* session only show up here, not via upsertRoom.
  hydrateRooms: (rooms, complete = true) =>
    set((state) => {
      const merged: Record<string, RoomState> = complete
        ? {}
        : { ...state.rooms };
      const messagesByRoom = { ...state.messagesByRoom };
      const deniedRooms = { ...state.deniedRooms };
      const joined = new Set(
        rooms.filter((r) => r.state === "join").map((r) => r.room_id),
      );
      if (complete)
        for (const id of Object.keys(state.rooms))
          if (!joined.has(id)) deniedRooms[id] = true;
      for (const id of joined) delete deniedRooms[id];
      if (complete)
        for (const id of Object.keys(messagesByRoom))
          if (!joined.has(id)) delete messagesByRoom[id];
      for (const room of rooms) {
        merged[room.room_id] = { ...merged[room.room_id], ...room };
      }
      return {
        rooms: merged,
        messagesByRoom,
        deniedRooms,
        continuationByRoom: Object.fromEntries(
          Object.entries(state.continuationByRoom).filter(
            ([room]) => !complete || joined.has(room),
          ),
        ),
        continuationReferenceByRoom: Object.fromEntries(
          Object.entries(state.continuationReferenceByRoom).filter(
            ([room]) => !complete || joined.has(room),
          ),
        ),
      };
    }),

  setInitialMessages: (roomId, events) =>
    set((state) =>
      state.deniedRooms[roomId]
        ? {}
        : {
            messagesByRoom: {
              ...state.messagesByRoom,
              [roomId]: mergeEvents(state.messagesByRoom[roomId] ?? [], events),
            },
          },
    ),

  applyEvents: (events) =>
    set((state) => {
      const messagesByRoom = { ...state.messagesByRoom };
      const rooms = { ...state.rooms };
      for (const event of events) {
        if (state.deniedRooms[event.room_id]) continue;
        const existing = messagesByRoom[event.room_id] ?? [];
        // SyncEngine always starts without a cursor on a fresh login (there's no cross-room
        // cursor to resume from), so on every app launch it re-delivers the entire history
        // a room's initial getMessages() load already fetched — dedup by event_id or every
        // message doubles up the moment sync catches up.
        if (existing.some((e) => e.event_id === event.event_id)) continue;
        messagesByRoom[event.room_id] = [...existing, event];
        rooms[event.room_id] = {
          ...(rooms[event.room_id] ?? {
            room_id: event.room_id,
            name: event.room_id,
          }),
          lastEvent: event,
        };
      }
      return { messagesByRoom, rooms };
    }),
}));

// Reactions ride on the normal event stream as m.room.reaction events (see types.ts) — there
// is no server-side aggregation (that's the "reactions" item still on Nimlet's roadmap), so
// grouping by target event happens here, client-side, on whatever's already in the store.
export function groupReactions(
  events: NimletEvent[],
): Map<string, Map<string, number>> {
  const byTarget = new Map<string, Map<string, number>>();
  for (const event of events) {
    if (event.type !== "m.room.reaction") continue;
    const content = event.content as ReactionContent;
    const forTarget =
      byTarget.get(content.relates_to) ?? new Map<string, number>();
    forTarget.set(content.emoji, (forTarget.get(content.emoji) ?? 0) + 1);
    byTarget.set(content.relates_to, forTarget);
  }
  return byTarget;
}

// Pagination hydration and live delivery can race. Neither may discard the other.
// Callers pass one room's events, so room_seq orders them.
export function mergeEvents(
  existing: NimletEvent[],
  incoming: NimletEvent[],
): NimletEvent[] {
  return Array.from(
    new Map([...existing, ...incoming].map((e) => [e.event_id, e])).values(),
  ).sort((a, b) => a.room_seq - b.room_seq);
}
