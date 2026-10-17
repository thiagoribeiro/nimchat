"use client";

import { t } from "@nimchat/i18n";
import { project } from "@nimchat/brian";
import type { Surface, Trust } from "@nimchat/brian";
import { useAuthStore, useChatStore } from "@nimchat/sdk";
import type { NimletEvent } from "@nimchat/sdk";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { brianTrust } from "@/lib/brian";
import { getNimletClient } from "@/lib/nimlet";

const PAGE_SIZE = 50;
const EMPTY: NimletEvent[] = [];

type HistoryStatus = "loading" | "loaded" | "error";
interface RoomContextValue {
  roomId: string;
  name: string;
  events: NimletEvent[];
  surfaces: Map<string, Surface>;
  trust: Trust;
  status: HistoryStatus;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<boolean>;
  reload: () => void;
}

const Context = createContext<RoomContextValue | null>(null);
export function useRoom() {
  const value = useContext(Context);
  if (!value) throw new Error("useRoom must be rendered inside a conversation");
  return value;
}

// Lives in the Next.js room layout, so navigating between Mensagens,
// Surfaces and a focused surface doesn't discard the loaded history.
export function RoomProvider({ roomId, children }: { roomId: string; children: React.ReactNode }) {
  const room = useChatStore((s) => s.rooms[roomId]);
  const events = useChatStore((s) => s.messagesByRoom[roomId]) ?? EMPTY;
  const setInitialMessages = useChatStore((s) => s.setInitialMessages);
  const userId = useAuthStore((s) => s.userId) ?? "";
  const trust = useMemo(() => brianTrust(userId), [userId]);
  const surfaces = useMemo(() => project(events, trust), [events, trust]);
  const [status, setStatus] = useState<HistoryStatus>("loading");
  const [oldest, setOldest] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getNimletClient().getMessages(roomId, { dir: "b", limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setInitialMessages(roomId, res.chunk);
        setOldest(res.chunk.length ? res.end : null);
        setHasMore(res.chunk.length === PAGE_SIZE);
        setStatus("loaded");
      }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [roomId, attempt, setInitialMessages]);

  const loadMore = useCallback(async () => {
    if (oldest === null || !hasMore || isLoadingMore) return false;
    setIsLoadingMore(true);
    try {
      const res = await getNimletClient().getMessages(roomId, {
        dir: "b", from: oldest, limit: PAGE_SIZE,
      });
      setInitialMessages(roomId, res.chunk);
      if (res.chunk.length) setOldest(res.end);
      setHasMore(res.chunk.length === PAGE_SIZE);
      return res.chunk.length > 0;
    } catch {
      return false;
    } finally {
      setIsLoadingMore(false);
    }
  }, [roomId, oldest, hasMore, isLoadingMore, setInitialMessages]);

  const value: RoomContextValue = {
    roomId, name: room?.name ?? t("Conversation"), events, surfaces, trust,
    status, hasMore, isLoadingMore, loadMore,
    reload: () => setAttempt((n) => n + 1),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
