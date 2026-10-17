import { t } from "@nimchat/i18n";
import { SurfaceAgentPanel } from "./surface-agent-panel";
import { canEdit, creationLabel, formQuestion, surfaceReference } from "@nimchat/brian";
import type { Surface, Block } from "@nimchat/brian";
import { useState, useEffect } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useChatStore } from "@nimchat/sdk";
import { v4 as uuid } from "uuid";
import { Button } from "@/components/ui/button";
import { pluginCommands, usePluginCommands } from "@/lib/plugin-commands";
import { getNimletClient } from "@/lib/nimlet";
import { colors } from "@/theme/tokens";
export function SurfaceManagement({
  surface,
  user,
}: {
  surface: Surface;
  user: string;
}) {
  const [name, setName] = useState(surface.title),
    [people, setPeople] = useState(""),
    [question, setQuestion] = useState(""),
    [error, setError] = useState(""),
    [review, setReview] = useState(false);

  const rooms = useChatStore((s) => s.rooms),
    view = surface.block.view,
    owner = view.owner_id === user;
  const structuredQuestion = formQuestion(surface.block);
  const pending = usePluginCommands((s) => s.commands.find((c) => c.roomId === surface.roomId && c.plugin === surface.block.plugin && c.instanceId === surface.block.instance_id && c.status !== "rejected"));
  const selected = people.split(",").map((s) => s.trim()).filter(Boolean);
  const preview = review && JSON.stringify(view.sharing_preview?.invitees) === JSON.stringify(selected) ? view.sharing_preview : undefined;
  useEffect(() => {
    if (
      view.transfer?.phase === "moved" &&
      rooms[view.transfer.room_id]?.state === "join"
    )
      router.replace(`/shared/${view.transfer.room_id}` as any);
  }, [view.transfer, rooms]);
  const send = async (command: string, payload: Block = {}) => {
    setError("");
    try {
      await pluginCommands
        .getState()
        .send(surface.roomId, surface.block, command, payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not save the command."));
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
  const ask = async (continuation = false) => {
    if (!question.trim()) return;
    try {
      await getNimletClient().sendEvent(
        surface.roomId,
        "m.room.message",
        uuid(),
        {
          msgtype: "m.text",
          body: question,
          ...(continuation
            ? { metadata: { continuation_of: view.request_id } }
            : {
                metadata: {
                  continuation_of:
                    useChatStore.getState().continuationByRoom[surface.roomId],
                },
              }),
        },
      );
      setQuestion("");
      useChatStore.getState().setContinuation(surface.roomId);
    } catch {
      setError(t("Failed to send to Brian."));
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.textMuted }}>
        {creationLabel(surface.createdAt)}
      </Text>
      {structuredQuestion && owner && !["submitted", "cancelled"].includes(view.status) && (
        <View>
          <Text style={{ color: colors.text }}>{t("Fill in and submit so Brian can continue your request.")}</Text>
          <Button label={t("Reply in the chat")} onPress={() => {
            useChatStore.getState().setContinuation(surface.roomId, structuredQuestion.request_event_id, surfaceReference(surface));
            router.push(`/rooms/${surface.roomId}` as any);
          }} />
        </View>
      )}
      {view.transfer ? (
        <View>
          <Text style={{ color: colors.text }}>
            {view.transfer.phase === "moved"
              ? t("Moved to another room")
              : t("Transfer in progress")}
          </Text>
          {view.transfer.room_id && (
            <Button
              label={t("Open shared surface")}
              onPress={() => {
                if (rooms[view.transfer.room_id]?.state !== "join") {
                  setError(t("Accept the invitation in Surfaces to open it."));
                  return;
                }
                router.push(
                  `/shared/${view.transfer.room_id}` as any,
                );
              }}
            />
          )}
          {owner && view.transfer.phase === "preparing" && (
            <Button
              label={t("Cancel transfer")}
              onPress={() => void send("cancel_transfer")}
            />
          )}
        </View>
      ) : (
        process.env.EXPO_PUBLIC_BRIAN_SURFACE_NAMES_ENABLED !== "false" &&
        canEdit(view, user) &&
        ["checklist", "poll", "form_stateful", "monthly_bills"].includes(
          surface.block.plugin,
        ) && (
          <View>
            <TextInput
              accessibilityLabel={t("Surface name")}
              style={field}
              maxLength={120}
              value={name}
              onChangeText={setName}
            />
            <Button
              label={t("Rename")}
              onPress={() => void send("rename", { title: name })}
            />
          </View>
        )
      )}
      {owner &&
        !view.transfer &&
        ["checklist", "monthly_bills"].includes(surface.block.plugin) &&
        process.env.EXPO_PUBLIC_BRIAN_SHARING_ENABLED === "true" && (
          <View>
            <Text style={{ color: colors.text }}>{t("Share with whom?")}</Text>
            <Text style={{ color: colors.textMuted }}>{t("Enter the usernames. You will review the participants before confirming.")}</Text>
            <TextInput
              accessibilityLabel={t("Guests by username")}
              style={field}
              placeholderTextColor={colors.textMuted}
              placeholder={t("user1, user2")}
              autoCapitalize="none"
              value={people}
              onChangeText={(text) => { setPeople(text); setReview(false); }}
            />
            <Button
              disabled={!!pending || (view.shared && !people.trim())}
              label={view.shared ? t("Invite person") : t("Review participants")}
              onPress={() => {
                if (view.shared) {
                  if (selected.length !== 1) { setError(t("Invite one person at a time.")); return; }
                  Alert.alert(t("Invite person"), t("Send an invitation to @{name}?", { name: selected[0] }), [
                    { text: t("Cancel"), style: "cancel" },
                    { text: t("Send invitation"), onPress: () => void send("invite_participant", { username: selected[0] }) },
                  ]);
                } else { setReview(true); void send("preview_share", { invitees: selected }); }
              }}
            />
            {!!preview && !view.shared && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text }}>{t("Participants who will have editor access:")}</Text>
                {(preview.participants ?? []).map((p: Block) => <Text key={p.user_id} style={{ color: colors.text }}>@{p.username}{p.user_id === user ? t(" (you, owner)") : ""}</Text>)}
                <Text style={{ color: colors.textMuted }}>{t("The list will move to Surfaces and a shortcut will stay in this conversation. The other people will need to accept the invitation.")}</Text>
                <Button label={t("Confirm sharing")} disabled={!!pending} onPress={() => Alert.alert(t("Confirm sharing"), t("{people} will have access. Move the list and send the invitations?", { people: (preview.participants ?? []).map((p: Block) => "@" + p.username).join(", ") }), [
                  { text: t("Cancel"), style: "cancel" },
                  { text: t("Share"), onPress: () => void send("share", { preview_token: preview.token }) },
                ])} />
                <Button label={t("Cancel sharing")} onPress={() => setReview(false)} />
              </View>
            )}
          </View>
        )}
      {view.shared && (
        <View>
          <Text style={{ color: colors.text }}>{t("Participants")}</Text>
          {(view.shared.participants ?? [])
            .filter((p: Block) => p.state !== "leave")
            .map((p: Block) => (
              <View key={p.user_id}>
                <Text style={{ color: colors.text }}>
                  {p.username}
                  {p.state === "invite" ? t(" · invitation sent") : ""}
                </Text>
                {owner && p.user_id !== user && (
                  <Button
                    label={t("Remove access")}
                    onPress={() =>
                      Alert.alert(t("Remove access"), p.username, [
                        { text: t("Cancel"), style: "cancel" },
                        {
                          text: t("Remove"),
                          style: "destructive",
                          onPress: () =>
                            void send("remove_participant", {
                              user_id: p.user_id,
                            }),
                        },
                      ])
                    }
                  />
                )}
              </View>
            ))}
        </View>
      )}
      {view.shared && <SurfaceAgentPanel roomId={surface.roomId} />}
      {(view.shared ||
        (surface.block.plugin === "agent_status" &&
          view.status === "waiting_user" &&
          owner)) && (
        <View>
          <TextInput
            accessibilityLabel={
              view.shared ? t("Ask Brian") : t("Reply to this request")
            }
            style={field}
            value={question}
            onChangeText={setQuestion}
          />
          <Button
            label={view.shared ? t("Ask Brian") : t("Send reply")}
            onPress={() => void ask(!view.shared)}
          />
        </View>
      )}
      {!!(error || view.sharing_error) && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error || t(view.sharing_error)}
        </Text>
      )}
    </View>
  );
}
