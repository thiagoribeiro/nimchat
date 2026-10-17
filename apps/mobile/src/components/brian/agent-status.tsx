import { t, locale } from "@nimchat/i18n";
import { useChatStore } from "@nimchat/sdk";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  instanceKey,
  statusStale,
  statusDuration,
} from "@nimchat/brian";
import type { Block, Trust } from "@nimchat/brian";
import { useBrianRead } from "@/lib/brian";
import { colors } from "@/theme/tokens";

export function AgentStatus({
  block,
  roomId,
  trust,
}: {
  block: Block;
  roomId: string;
  trust: Trust;
}) {
  const key = instanceKey(roomId, block.plugin, block.instance_id);
  const expanded = useBrianRead((s) => s.expanded[key] ?? false);
  const toggle = useBrianRead((s) => s.expand);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const view = block.view;
  const stale = statusStale(view, clock);
  const active = view.status === "running";
  const count = Math.max(0, (view.active_activities?.length ?? 0) - 1);
  return (
    <View
      style={{
        marginTop: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded
            ? t("Collapse agent activity")
            : t("Expand agent activity")
        }
        accessibilityState={{ expanded }}
        onPress={() => toggle(key, !expanded)}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        {active && !stale ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={{ color: colors.textSecondary }}>
            {view.status === "completed"
              ? "✓"
              : view.status === "failed"
                ? "!"
                : "·"}
          </Text>
        )}
        <Text style={{ color: colors.text, flex: 1 }}>
          {view.current_status}
          {count ? t(" (+{count} activities)", { count }) : ""}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          {expanded ? "▴" : "▾"}
        </Text>
      </Pressable>
      {view.status === "waiting_user" && view.owner_id === trust.userId && (
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 44, justifyContent: "center" }}
          onPress={() =>
            useChatStore.getState().setContinuation(roomId, view.request_id)
          }
        >
          <Text style={{ color: colors.primary }}>
            {t("Reply to this request")}
          </Text>
        </Pressable>
      )}
      {stale && (
        <Text style={{ color: colors.warning, marginTop: 6 }}>
          {t("No recent update")}
        </Text>
      )}
      {expanded && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={{ color: colors.textMuted }}>
            {t("Time:")} {statusDuration(view.started_at, view.finished_at, clock)}
          </Text>
          {view.history_total > view.history.length && (
            <Text style={{ color: colors.textMuted }}>
              {t("Latest {shown} of {total} steps", { shown: view.history.length, total: view.history_total })}
            </Text>
          )}
          {view.history.map((entry: Block) => (
            <View
              key={entry.id}
              style={{
                borderLeftWidth: 2,
                borderColor:
                  entry.status === "failed" ? colors.danger : colors.textMuted,
                paddingLeft: 10,
              }}
            >
              <Text style={{ color: colors.text }}>
                {entry.label} ·{" "}
                {entry.status === "running"
                  ? t("in progress")
                  : entry.status === "failed"
                    ? "falhou"
                    : entry.status === "interrupted"
                      ? "interrompido"
                      : t("done")}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {new Date(entry.started_at).toLocaleTimeString(locale(), {
                })}{" "}
                · {statusDuration(entry.started_at, entry.finished_at, clock)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
