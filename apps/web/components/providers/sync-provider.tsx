"use client";
import { t } from "@nimchat/i18n";
import { recoverCommandHistory } from "@nimchat/sdk";

import { surfacePins } from "@nimchat/brian";
import {
  SyncEngine,
  cachedRooms,
  createTimelinePersister,
  rejectedSession,
  useAuthStore,
  useChatStore
} from "@nimchat/sdk";
import type { RoomState, TimelinePersister } from "@nimchat/sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

import { getNimletClient, NIMLET_URL } from "@/lib/nimlet";
import { brianTrust } from "@/lib/brian";
import { pluginCommands } from "@/lib/plugin-commands";
import { RoomRefreshController } from "@/lib/room-refresh";
import type { RoomRefreshState } from "@/lib/room-refresh";
import { timelineCache } from "@/lib/timeline-cache";
import { InviteDismissals } from "@nimchat/sdk/invite-dismissals";

type SyncContextType = RoomRefreshState & {
  isConnected: boolean;
  refreshRooms: () => Promise<void>;
  confirmRoomJoined: (room: RoomState) => void;
  dismissedInvites: ReadonlySet<string>;
  dismissInvite: (roomId: string) => void;
  restoreInvite: (roomId: string) => void;
};

const SyncContext = createContext<SyncContextType>({
  isConnected: false,
  isRefreshingRooms: false,
  roomRefreshError: null,
  refreshRooms: async () => {},
  confirmRoomJoined: () => {},
  dismissedInvites: new Set(),
  dismissInvite: () => {},
  restoreInvite: () => {}
});

export const useSync = () => useContext(SyncContext);

// Replaces the donor's socket-provider: instead of a socket.io connection, this owns a
// SyncEngine that long-polls GET /sync and feeds new events straight into useChatStore.
// isConnected here means "the sync loop is running", not any transport-level handshake —
// there's no separate connect/disconnect event for long-polling.
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.userId);
  const applyEvents = useChatStore((s) => s.applyEvents);
  const [isConnected, setIsConnected] = useState(false);
  const engineRef = useRef<SyncEngine | null>(null);
  const roomsRef = useRef<RoomRefreshController | null>(null);
  const invitesRef = useRef<InviteDismissals | null>(null);
  const [invitePrefs, setInvitePrefs] = useState<{
    user: string;
    ids: ReadonlySet<string>;
  }>({ user: "", ids: new Set() });
  const localInvites = () => {
    const auth = useAuthStore.getState(),
      prefs = invitesRef.current;
    if (!auth.isAuthenticated || !prefs || prefs.user !== auth.userId)
      throw new Error(t("Session ended"));
    return prefs;
  };
  const dismissInvite = useCallback(
    (id: string) => localInvites().dismiss(id),
    []
  );
  const restoreInvite = useCallback(
    (id: string) => localInvites().restore(id),
    []
  );
  const [roomState, setRoomState] = useState<RoomRefreshState>({
    isRefreshingRooms: false,
    roomRefreshError: null
  });
  const refreshRooms = useCallback(
    () => roomsRef.current?.refresh() ?? Promise.resolve(),
    []
  );
  const confirmRoomJoined = useCallback(
    (room: RoomState) => roomsRef.current?.confirmJoined(room),
    []
  );

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      engineRef.current?.stop();
      engineRef.current = null;
      setIsConnected(false);
      setRoomState({ isRefreshingRooms: false, roomRefreshError: null });
      pluginCommands.getState().stop();
      return;
    }

    let live = true;
    const current = () =>
      live &&
      useAuthStore.getState().isAuthenticated &&
      useAuthStore.getState().userId === userId;
    useChatStore.getState().reset();
    const cache = timelineCache(userId);
    let persister: TimelinePersister | undefined;
    let engine: SyncEngine | undefined;
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {}
    const invites = new InviteDismissals(
      userId,
      {
        getItem: (key) => storage?.getItem(key) ?? null,
        setItem: (key, value) => {
          if (!storage)
            throw new Error(t("Local storage unavailable"));
          storage.setItem(key, value);
        }
      },
      (ids) => {
        if (current()) setInvitePrefs({ user: userId, ids });
      }
    );
    invitesRef.current = invites;
    pluginCommands
      .getState()
      .initialize(
        userId,
        storage,
        brianTrust(userId),
        (roomId, txn, content) =>
          getNimletClient().sendEvent(
            roomId,
            "m.plugin.command",
            txn,
            content
          ),
        NIMLET_URL,
        process.env.NEXT_PUBLIC_NIMLET_NAMESPACE ?? "default",
        (room, eventId) => recoverCommandHistory(getNimletClient(), room, eventId, (id, events) => {
          if (current() && useChatStore.getState().rooms[id]?.state === "join")
            useChatStore.getState().setInitialMessages(id, events as any);
        })
      );
    const unsubscribe = useChatStore.subscribe((state, prev) => {
      if (!current()) return;
      pluginCommands.getState().observe(state.messagesByRoom);
      if (state.messagesByRoom !== prev.messagesByRoom || state.rooms !== prev.rooms)
        persister?.schedule();
    });
    const rooms = new RoomRefreshController({
      load: () => getNimletClient().listRooms(),
      hydrate: (items, complete = true) => {
        useChatStore.getState().hydrateRooms(items, complete);
        pluginCommands.getState().setRooms(
          new Set(
            Object.values(useChatStore.getState().rooms)
              .filter((r) => r.state === "join")
              .map((r) => r.room_id)
          )
        );
      },
      isCurrentSession: current,
      onState: setRoomState
    });
    roomsRef.current = rooms;
    // The cached snapshot seeds the store and gives /sync its cursor, so a reload only
    // receives what changed. Rooms and sync wait for it (a local read): a room list that
    // landed first could be undone by cached events of a room left meanwhile.
    const visibility = () => {
      const active = document.visibilityState === "visible";
      rooms.setActive(active);
      if (active) {
        engine?.start();
        pluginCommands.getState().retryPending();
      } else {
        engine?.stop();
        void persister?.flush();
      }
      setIsConnected(active);
    };
    void cache.load().then((snapshot) => {
      if (!current()) return;
      if (snapshot?.rooms?.length)
        useChatStore.getState().hydrateRooms(snapshot.rooms, false);
      if (snapshot?.events.length) applyEvents(snapshot.events);
      const timeline = createTimelinePersister({
        storage: cache,
        read: () => useChatStore.getState().messagesByRoom,
        rooms: () => cachedRooms(useChatStore.getState().rooms),
        retain: { pin: surfacePins(brianTrust(userId)) },
        cursor: snapshot?.cursor
      });
      persister = timeline;
      engine = new SyncEngine({
        client: getNimletClient(),
        since: snapshot?.cursor,
        onEvents: (events, nextBatch) => {
          if (current()) {
            applyEvents(events);
            timeline.noteCursor(nextBatch);
            setIsConnected(true);
          }
        },
        onError: (err) => {
          if (!current()) return;
          setIsConnected(false);
          // A session resumed offline (or expired meanwhile) is only checked here.
          if (rejectedSession(err)) useAuthStore.getState().expire();
        }
      });
      engineRef.current = engine;
      visibility();
      document.addEventListener("visibilitychange", visibility);
    });

    return () => {
      live = false;
      document.removeEventListener("visibilitychange", visibility);
      rooms.stop();
      if (invitesRef.current === invites) invitesRef.current = null;
      if (roomsRef.current === rooms) roomsRef.current = null;
      unsubscribe();
      pluginCommands.getState().stop();
      engine?.stop();
      engineRef.current = null;
      const auth = useAuthStore.getState();
      // Logged out: drop this user's cache (shared browsers). Otherwise keep the latest.
      if (auth.isAuthenticated && auth.userId === userId) void persister?.stop();
      else void (persister?.discard() ?? Promise.resolve()).then(() => cache.clear());
    };
  }, [isAuthenticated, userId, applyEvents]);

  return (
    <SyncContext.Provider
      value={{
        isConnected,
        ...roomState,
        refreshRooms,
        confirmRoomJoined,
        dismissedInvites:
          invitePrefs.user === userId ? invitePrefs.ids : new Set(),
        dismissInvite,
        restoreInvite
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
