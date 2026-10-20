import { t } from "@nimchat/i18n";
import { recoverCommandHistory } from "@nimchat/sdk";
import { pluginCommands, commandStorage } from "@/lib/plugin-commands";
import { trustFor } from "@/lib/brian";
import {
  SyncEngine,
  rejectedSession,
  useAuthStore,
  useChatStore,
} from "@nimchat/sdk";
import type { RoomState } from "@nimchat/sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { getNimletClient, NIMLET_URL } from "@/lib/nimlet";
import { RoomRefreshController } from "@/lib/room-refresh";
import type { RoomRefreshState } from "@/lib/room-refresh";
import { InviteDismissals } from "@nimchat/sdk/invite-dismissals";
import { inviteStorage } from "@/lib/invite-storage";

import { useBrianRead } from "@/lib/brian";

// Mirrors the server's sync query limit (nimlet internal/usecase/sync.go).
const SYNC_PAGE = 100;

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
  restoreInvite: () => {},
});

export const useSync = () => useContext(SyncContext);

// Mirrors apps/web's sync-provider.tsx, plus one thing the web version doesn't need:
// pausing on background. Locking the screen doesn't kill a foregrounded RN app — the
// JS thread (and this engine's /sync loop) keeps running for a while unless something
// stops it. Left unchecked, that keeps touching server-side presence (see backend's
// PresenceStore) indefinitely, which silently suppresses push notifications for a
// device the user isn't actually looking at — exactly the case push exists for.
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
    [],
  );
  const restoreInvite = useCallback(
    (id: string) => localInvites().restore(id),
    [],
  );
  const [roomState, setRoomState] = useState<RoomRefreshState>({
    isRefreshingRooms: false,
    roomRefreshError: null,
  });
  const refreshRooms = useCallback(
    () => roomsRef.current?.refresh() ?? Promise.resolve(),
    [],
  );
  const confirmRoomJoined = useCallback(
    (room: RoomState) => roomsRef.current?.confirmJoined(room),
    [],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      engineRef.current?.stop();
      engineRef.current = null;
      setIsConnected(false);
      setRoomState({ isRefreshingRooms: false, roomRefreshError: null });
      return;
    }

    useChatStore.getState().reset();
    useBrianRead.getState().initialize(userId!);
    pluginCommands
      .getState()
      .initialize(
        userId!,
        commandStorage,
        trustFor(userId!),
        (room, txn, content) =>
          getNimletClient().sendEvent(room, "m.plugin.command", txn, content),
        NIMLET_URL,
        process.env.EXPO_PUBLIC_NIMLET_NAMESPACE ?? "default",
        (room, eventId) => recoverCommandHistory(getNimletClient(), room, eventId, (id, events) => {
          if (current() && useChatStore.getState().rooms[id]?.state === "join")
            useChatStore.getState().setInitialMessages(id, events as any);
        }),
      );
    const unsubscribeCommands = useChatStore.subscribe((s, prev) => {
      pluginCommands.getState().observe(s.messagesByRoom);
      // Room pages and room-list pruning change the cache too, not only sync batches.
      if (s.messagesByRoom !== prev.messagesByRoom || s.rooms !== prev.rooms)
        useBrianRead.getState().persist();
    });
    let live = true;
    const current = () =>
      live &&
      useAuthStore.getState().isAuthenticated &&
      useAuthStore.getState().userId === userId;
    const invites = new InviteDismissals(userId!, inviteStorage, (ids) => {
      if (current()) setInvitePrefs({ user: userId!, ids });
    });
    invitesRef.current = invites;
    const rooms = new RoomRefreshController({
      load: () => getNimletClient().listRooms(),
      hydrate: (items, complete = true) => {
        useChatStore.getState().hydrateRooms(items, complete);
        pluginCommands.getState().setRooms(
          new Set(
            Object.values(useChatStore.getState().rooms)
              .filter((r) => r.state === "join")
              .map((r) => r.room_id),
          ),
        );
        if (complete)
          useBrianRead
            .getState()
            .retainRooms(
              new Set(
                items.filter((r) => r.state === "join").map((r) => r.room_id),
              ),
            );
      },
      isCurrentSession: current,
      onState: setRoomState,
    });
    roomsRef.current = rooms;
    // Without stored read positions (fresh install), the initial sync replay is
    // history, not news. The server answers catch-up in full pages of
    // SYNC_PAGE events; the first short page ends the replay.
    let baseline = Object.keys(useBrianRead.getState().roomSeen).length === 0;
    // Resuming from the cached cursor, /sync only delivers what the cache hasn't seen.
    const engine = new SyncEngine({
      client: getNimletClient(),
      since: useBrianRead.getState().cursor,
      onEvents: (events, nextBatch) => {
        if (!current()) return;
        setIsConnected(AppState.currentState === "active");
        applyEvents(events);
        if (baseline) {
          useBrianRead.getState().baselineRooms(events);
          if (events.length < SYNC_PAGE) baseline = false;
        }
        useBrianRead.getState().noteCursor(nextBatch);
      },
      onError: (err) => {
        if (!current()) return;
        setIsConnected(false);
        // A session resumed offline (or expired meanwhile) is only checked here.
        if (rejectedSession(err)) useAuthStore.getState().expire();
      },
    });
    engineRef.current = engine;

    const applyAppState = (state: string) => {
      rooms.setActive(state === "active");
      if (state === "active") {
        engine.start();
        pluginCommands.getState().retryPending();
        setIsConnected(true);
      } else {
        engine.stop();
        setIsConnected(false);
        useBrianRead.getState().flush();
      }
    };
    applyAppState(AppState.currentState);
    const subscription = AppState.addEventListener("change", applyAppState);

    return () => {
      live = false;
      subscription.remove();
      unsubscribeCommands();
      pluginCommands.getState().stop();
      rooms.stop();
      if (invitesRef.current === invites) invitesRef.current = null;
      if (roomsRef.current === rooms) roomsRef.current = null;
      engine.stop();
      engineRef.current = null;
      const auth = useAuthStore.getState();
      if (auth.isAuthenticated && auth.userId === userId) useBrianRead.getState().flush();
      else useBrianRead.getState().forget();
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
        restoreInvite,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
