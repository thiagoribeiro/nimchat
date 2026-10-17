import { t } from "@nimchat/i18n";
import { useChatStore } from "@nimchat/sdk";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { create } from "zustand";

import { getNimletClient } from "@/lib/nimlet";

const PAGE = 50;

export interface RoomHistory {
  status: "loading" | "loaded" | "error";
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<boolean>;
  reload: () => void;
}

// History pagination lives at the room level so Messages, Surfaces and
// the focus view (including a cold deep link) share one loaded window.
export function useRoomHistoryLoader(roomId: string): RoomHistory {
  const setInitialMessages = useChatStore((s) => s.setInitialMessages);
  const [status, setStatus] = useState<RoomHistory["status"]>("loading");
  const [oldest, setOldest] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setStatus("loading");
    getNimletClient()
      .getMessages(roomId, { dir: "b", limit: PAGE })
      .then((res) => {
        if (cancelled) return;
        setInitialMessages(roomId, res.chunk);
        setOldest(res.chunk.length ? res.end : null);
        setHasMore(res.chunk.length >= PAGE);
        setStatus("loaded");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [roomId, setInitialMessages, attempt]);

  const loadMore = useCallback(async () => {
    if (oldest === null || isLoadingMore || !hasMore) return false;
    setIsLoadingMore(true);
    try {
      const res = await getNimletClient().getMessages(roomId, { dir: "b", from: oldest, limit: PAGE });
      if (res.chunk.length > 0) {
        setInitialMessages(roomId, res.chunk);
        setOldest(res.end);
      }
      setHasMore(res.chunk.length >= PAGE);
      return res.chunk.length > 0;
    } catch {
      return false;
    } finally {
      setIsLoadingMore(false);
    }
  }, [roomId, oldest, isLoadingMore, hasMore, setInitialMessages]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { status, hasMore, isLoadingMore, loadMore, reload };
}

export interface RoomContextValue {
  roomId: string;
  name: string;
  history: RoomHistory;
}
const RoomContext = createContext<RoomContextValue | null>(null);
export const RoomProvider = RoomContext.Provider;
export function useRoom(): RoomContextValue {
  const value = useContext(RoomContext);
  if (!value) throw new Error("useRoom outside a room route");
  return value;
}

export const displayRoomName = (name: string) => (name === "direct" ? t("Direct message") : name);

// "Ver mensagem de origem" from a focus view: the timeline consumes this and
// scrolls to the card. A nonce lets the same origin be requested again.
export interface OriginRequest {
  roomId: string;
  eventId: string;
  nonce: number;
}
export const useOriginRequest = create<{
  request?: OriginRequest;
  requestOrigin: (roomId: string, eventId: string) => void;
}>((set) => ({
  requestOrigin: (roomId, eventId) => set({ request: { roomId, eventId, nonce: Date.now() } }),
}));
