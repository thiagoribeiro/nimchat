import { t } from "@nimchat/i18n";
import { groupReactions, useAuthStore } from "@nimchat/sdk";
import type { TimelineRow } from "@nimchat/brian/agent-timeline";
import { useFocusEffect } from "expo-router";
import { MessageSquare } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { AgentTurn } from "@/components/chat/agent-turn";
import { agentTimeline } from "@nimchat/brian/agent-timeline";
import { displayRoomName, useRoom } from "@/components/chat/room-context";
import { OutgoingItem } from "@/components/chat/outgoing-item";
import { EmptyState, ErrorBanner } from "@/components/ui/feedback";
import { useBrianRead, useRoomEvents, useRoomSurfaces } from "@/lib/brian";
import { useOutbox } from "@/lib/outbox";
import type { OutgoingMessage } from "@/lib/outbox";
import { colors, space } from "@/theme/tokens";
import { type } from "@/theme/typography";

type Row = { kind: "event"; event: TimelineRow } | { kind: "outgoing"; item: OutgoingMessage };
const MAX_SEEK_PAGES = 10;

export function ChatMessages({ seek }: { seek?: { eventId: string; key: string } }) {
  const { roomId, name, history } = useRoom();
  const events = useRoomEvents(roomId);
  const { surfaces, trust } = useRoomSurfaces(roomId);
  const userId = useAuthStore((s) => s.userId);
  const outbox = useOutbox((s) => s.items);
  const discard = useOutbox((s) => s.discard);
  const markRoom = useBrianRead((s) => s.markRoom);
  const listRef = useRef<FlatList<Row>>(null);
  const [highlight, setHighlight] = useState<string | undefined>();
  const [seekNotice, setSeekNotice] = useState("");

  // FlatList `inverted` renders index 0 at the bottom, so newest-first ordering
  // keeps the conversation anchored to the composer.
  const social = useMemo(
    () => agentTimeline(events, surfaces, trust).sort((a, b) => b.room_seq - a.room_seq),
    [events, surfaces, trust],
  );
  const delivered = useMemo(() => new Set(social.flatMap((e) => e.eventIds)), [social]);
  const outgoing = useMemo(
    () =>
      Object.values(outbox)
        .filter((m) => m.roomId === roomId && !(m.eventId && delivered.has(m.eventId)))
        .sort((a, b) => b.createdAt - a.createdAt),
    [outbox, roomId, delivered],
  );
  // Drop local echoes once the server copy is in the store.
  useEffect(() => {
    for (const m of Object.values(outbox))
      if (m.roomId === roomId && m.eventId && delivered.has(m.eventId)) discard(m.txn);
  }, [outbox, roomId, delivered, discard]);

  const rows = useMemo<Row[]>(
    () => [
      ...outgoing.map((item) => ({ kind: "outgoing" as const, item })),
      ...social.map((event) => ({ kind: "event" as const, event })),
    ],
    [outgoing, social],
  );
  const reactionsByTarget = useMemo(() => groupReactions(events), [events]);

  // Reading the timeline marks only the timeline; surfaces keep their own state.
  const newest = Math.max(0, ...social.map((r) => r.readSeq));
  useFocusEffect(
    useCallback(() => {
      if (newest) markRoom(roomId, newest);
    }, [roomId, newest, markRoom]),
  );

  // "Back to the original message": page back until the source card is loaded.
  const rowsRef = useRef(rows);
  const historyRef = useRef(history);
  useEffect(() => {
    rowsRef.current = rows;
    historyRef.current = history;
  });
  const seeking = useRef<string | undefined>(undefined);
  const focusEvent = seek?.eventId;
  useEffect(() => {
    if (!seek || history.status !== "loaded" || seeking.current === seek.key) return;
    seeking.current = seek.key;
    setSeekNotice("");
    let cancelled = false;
    (async () => {
      for (let page = 0; page <= MAX_SEEK_PAGES && !cancelled; page++) {
        if (rowsRef.current.some((r) => r.kind === "event" && r.event.eventIds.includes(focusEvent ?? ""))) {
          setHighlight(focusEvent);
          return;
        }
        if (!(await historyRef.current.loadMore())) break;
        // Let the new page render before checking again.
        await new Promise((r) => setTimeout(r, 50));
      }
      if (!cancelled) setSeekNotice(t("The original message is not in the available history."));
    })();
    return () => {
      cancelled = true;
    };
  }, [seek, focusEvent, history.status]);

  useEffect(() => {
    if (!highlight) return;
    const index = rows.findIndex((r) => r.kind === "event" && r.event.eventIds.includes(highlight ?? ""));
    if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    const timer = setTimeout(() => setHighlight(undefined), 2500);
    return () => clearTimeout(timer);
    // Scroll once per highlight; later rows changes must not yank the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);

  if (history.status === "loading" && social.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (history.status === "error" && social.length === 0) {
    return (
      <View style={styles.center}>
        <ErrorBanner message={t("Could not load the messages.")} onAction={history.reload} />
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {!!seekNotice && (
        <Text style={[type.caption, styles.notice]} accessibilityLiveRegion="polite">
          {seekNotice}
        </Text>
      )}
      {rows.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={28} color={colors.textMuted} />}
          title={t("Welcome to {name}", { name: name === "direct" ? t("this conversation") : displayRoomName(name) })}
          description={t("Send the first message.")}
        />
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.content}
          data={rows}
          inverted
          keyExtractor={(r) => (r.kind === "event" ? r.event.key : `txn:${r.item.txn}`)}
          renderItem={({ item: r }) =>
            r.kind === "event" ? (
              <AgentTurn row={r.event} reactions={reactionsByTarget} trust={trust}
                highlighted={r.event.eventIds.includes(highlight ?? "")} surfaces={surfaces} />
            ) : (
              <OutgoingItem item={r.item} senderId={userId ?? ""} />
            )
          }
          onEndReached={() => void history.loadMore()}
          onEndReachedThreshold={0.3}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
            setTimeout(
              () => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }),
              120,
            );
          }}
          ListFooterComponent={
            history.isLoadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.textMuted} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { paddingVertical: space.sm },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    backgroundColor: colors.background,
  },
  notice: { textAlign: "center", padding: space.sm, backgroundColor: colors.surfaceRaised },
  loadingMore: { paddingVertical: space.md },
});
