import { t, timeZone } from "@nimchat/i18n";
import {
  isSharedRoom,
  project,
  pluginLabel,
  statusInfo,
} from "@nimchat/brian";
import { useChatStore, loadSharedSurfaceHistory } from "@nimchat/sdk";
import { useEffect, useMemo, useState } from "react";
import { Text, Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { v4 as uuid } from "uuid";
import { useTrust } from "@/lib/brian";
import { getNimletClient } from "@/lib/nimlet";
import { Button } from "@/components/ui/button";
import { InviteInbox } from "@/components/rooms/invite-inbox";
import { colors } from "@/theme/tokens";
export function SharedSurfaces() {
  const rooms = useChatStore((s) => s.rooms),
    events = useChatStore((s) => s.messagesByRoom),
    trust = useTrust();
  const [create, setCreate] = useState(false),
    [origin, setOrigin] = useState(""),
    [title, setTitle] = useState(""),
    [people, setPeople] = useState(""),
    [items, setItems] = useState(""),
    [plugin, setPlugin] = useState("checklist"),
    [error, setError] = useState("");
  const list = useMemo(
    () =>
      Object.values(rooms).filter(
        (r) => r.state === "join" && isSharedRoom(r.name),
      ),
    [rooms],
  );
  const roomKey = JSON.stringify(list.map((r) => [r.room_id, r.name]).sort());
  const [attempt, setAttempt] = useState(0);
  const [historyStatus, setHistoryStatus] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    setError("");
    void Promise.allSettled(list.map(async (r) => {
      const ready = () => [...project(useChatStore.getState().messagesByRoom[r.room_id] ?? [], trust).values()].filter((s) =>
        s.block.view.shared?.room_id === r.room_id &&
        `#shared-surface:${s.block.view.shared.id}#`.toLowerCase() === r.name.toLowerCase()).length === 1;
      if (ready()) return;
      setHistoryStatus((s) => ({ ...s, [r.room_id]: "loading" }));
      try {
        const result = await loadSharedSurfaceHistory({
          roomId: r.room_id,
          load: (id, opts) => getNimletClient().getMessages(id, opts),
          ready,
          canRead: () => live && useChatStore.getState().rooms[r.room_id]?.state === "join",
          apply: (events) => useChatStore.getState().setInitialMessages(r.room_id, events),
        });
        if (live) setHistoryStatus((s) => ({ ...s, [r.room_id]: result }));
      } catch {
        if (live) setHistoryStatus((s) => ({ ...s, [r.room_id]: "error" }));
      }
    }));
    return () => { live = false; };
  }, [roomKey, trust.userId, attempt]);
  const submit = async () => {
    if (!origin || !title.trim()) return;
    try {
      await getNimletClient().sendEvent(origin, "m.plugin.command", uuid(), {
        plugin,
        instance_id: "create:" + uuid(),
        command: "create_shared",
        payload: {
          title: title.trim(),
          data:
            plugin === "checklist"
              ? {
                  items: items
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((label) => ({ id: uuid(), label })),
                }
              : { timezone: timeZone() },
          invitees: people
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      setCreate(false);
      setError(t("Creation requested. Wait for the plugin to confirm it."));
    } catch {
      setError(t("Failed to request creation."));
    }
  };
  const field = {
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 44,
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <InviteInbox
        rooms={Object.values(rooms).filter(
          (r) => r.state === "invite" && isSharedRoom(r.name),
        )}
      />
      {list.map((r) => {
        const ss = [...project(events[r.room_id] ?? [], trust).values()].filter(
          (s) =>
            s.block.view.shared?.room_id === r.room_id &&
            `#shared-surface:${s.block.view.shared.id}#`.toLowerCase() ===
              r.name.toLowerCase(),
        );
        return (
          <Pressable
            key={r.room_id}
            accessibilityRole="button"
            onPress={() => router.push(`/shared/${r.room_id}` as any)}
            style={{
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: colors.text }}>
              {ss.length === 1 ? ss[0].title : historyStatus[r.room_id] === "error" ? t("Failed to load surface") : historyStatus[r.room_id] === "missing" ? t("Waiting for the surface to be published") : t("Loading surface…")}
            </Text>
            {ss.length === 1 && (
              <Text style={{ color: colors.textMuted }}>
                {pluginLabel(ss[0].block.plugin)} ·{" "}
                {statusInfo(ss[0].block.view).label} ·{" "}
                {(ss[0].block.view.shared.participants ?? [])
                  .filter((p: any) => p.state !== "leave")
                  .map((p: any) => p.username)
                  .join(", ")}
              </Text>
            )}
          </Pressable>
        );
      })}
      {list.some((r) => ["error", "missing"].includes(historyStatus[r.room_id])) && (
        <Button label={t("Try loading again")} onPress={() => setAttempt((n) => n + 1)} />
      )}
      {!list.length && (
        <Text style={{ color: colors.textMuted }}>
          {t("No shared surfaces.")}
        </Text>
      )}
      {process.env.EXPO_PUBLIC_BRIAN_SHARING_ENABLED === "true" && (
        <Button
          label={t("Create shared surface")}
          onPress={() => setCreate(!create)}
        />
      )}
      {create && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text }}>
            {t("Original conversation with Brian: every human participant will be invited")}
          </Text>
          {Object.values(rooms)
            .filter(
              (r) =>
                r.state === "join" &&
                !isSharedRoom(r.name) &&
                (events[r.room_id] ?? []).some(
                  (e) =>
                    trust.agents.has(e.sender_id) ||
                    trust.publishers.has(e.sender_id),
                ),
            )
            .map((r) => (
              <Button
                key={r.room_id}
                label={(origin === r.room_id ? "✓ " : "") + r.name}
                onPress={() => setOrigin(r.room_id)}
              />
            ))}
          <Button
            label={plugin === "checklist" ? t("✓ Checklist") : "Checklist"}
            onPress={() => setPlugin("checklist")}
          />
          {process.env.EXPO_PUBLIC_BRIAN_MONTHLY_BILLS_ENABLED === "true" && (
            <Button
              label={
                plugin === "monthly_bills"
                  ? t("✓ Monthly bills")
                  : t("Monthly bills")
              }
              onPress={() => setPlugin("monthly_bills")}
            />
          )}
          <TextInput
            style={field}
            accessibilityLabel={t("New surface name")}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={field}
            accessibilityLabel={t("Additional guests")}
            value={people}
            onChangeText={setPeople}
          />
          {plugin === "checklist" && (
            <TextInput
              style={field}
              accessibilityLabel={t("Checklist items, one per line")}
              multiline
              value={items}
              onChangeText={setItems}
            />
          )}
          <Button
            label={t("Create")}
            disabled={
              !origin ||
              !title.trim() ||
              (plugin === "checklist" && !items.trim())
            }
            onPress={() => void submit()}
          />
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.textMuted }}>
          {error}
        </Text>
      )}
    </ScrollView>
  );
}
