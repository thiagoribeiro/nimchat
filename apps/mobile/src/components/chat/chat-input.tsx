import { t, locale } from "@nimchat/i18n";
import { useChatStore } from "@nimchat/sdk";
import { surfaceReference, canEdit, pluginLabel } from "@nimchat/brian";
import type { Surface, Block } from "@nimchat/brian";
import { useRoomSurfaces } from "@/lib/brian";
import type { AttachmentContent } from "@nimchat/sdk";
import * as ImagePicker from "expo-image-picker";
import { Paperclip, SendHorizontal } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { v4 as uuidv4 } from "uuid";

import { displayRoomName } from "@/components/chat/room-context";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { getNimletClient } from "@/lib/nimlet";
import { useOutbox } from "@/lib/outbox";
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

export function ChatInput({ roomId, name }: { roomId: string; name: string }) {
  const [content, setContent] = useState("");
  const continuation = useChatStore((s) => s.continuationByRoom[roomId]);
  const continuationReference = useChatStore((s) => s.continuationReferenceByRoom[roomId]);
  const [references, setReferences] = useState<Block[]>([]);
  const { surfaces, trust } = useRoomSurfaces(roomId);
  const mention = content.match(/(?:^|\s)@([^@]*)$/)?.[1];
  const candidates =
    mention === undefined
      ? []
      : [...surfaces.values()]
          .filter(
            (s) =>
              !s.block.view.transfer &&
              canEdit(s.block.view, trust.userId) &&
              s.title.toLowerCase().includes(mention.toLowerCase()),
          )
          .slice(0, 8);
  const select = (s: Surface) => {
    setContent((c) => c.replace(/@([^@]*)$/, "@" + s.title + " "));
    setReferences((refs) => [
      ...refs.filter((r) => r.metadata?.instance_id !== s.block.instance_id),
      surfaceReference(s),
    ]);
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const send = useOutbox((s) => s.send);
  const canSend = content.trim().length > 0;

  const onSend = () => {
    const body = content.trim();
    if (!body) return;
    setContent("");
    send(roomId, body, {
      surface_references: [...references, ...(continuationReference ? [continuationReference] : [])],
      continuation_of: continuation,
    });
    setReferences([]);
    useChatStore.getState().setContinuation(roomId);
  };

  const onPickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setIsUploading(true);
    setUploadError("");
    try {
      const client = getNimletClient();
      const blob = await (await fetch(asset.uri)).blob();
      const filename = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const uploaded = await client.uploadMedia(blob, filename);
      await client.sendEvent<AttachmentContent>(
        roomId,
        "m.room.attachment",
        uuidv4(),
        {
          content_uri: uploaded.content_uri,
          filename,
          mimetype: asset.mimeType ?? "image/jpeg",
          size: asset.fileSize,
        },
      );
    } catch {
      setUploadError(t("Could not send the image."));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!!uploadError && (
        <Text accessibilityRole="alert" style={[type.caption, styles.error]}>
          {uploadError}
        </Text>
      )}
      {continuation && (
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 44 }}
          onPress={() => useChatStore.getState().setContinuation(roomId)}
        >
          <Text style={{ color: colors.primary }}>
            {t("Replying to the selected request · unlink")}
          </Text>
        </Pressable>
      )}
      {candidates.map((s) => (
        <Pressable
          key={s.key}
          accessibilityRole="button"
          style={{ minHeight: 44, padding: 8 }}
          onPress={() => select(s)}
        >
          <Text style={{ color: colors.text }}>
            @{s.title} · {pluginLabel(s.block.plugin)} ·{" "}
            {s.createdAt
              ? new Date(s.createdAt).toLocaleString(locale())
              : t("Date unavailable")}
          </Text>
        </Pressable>
      ))}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Attach image")}
          onPress={onPickImage}
          disabled={isUploading}
          style={styles.iconButton}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Paperclip size={20} color={colors.textMuted} />
          )}
        </Pressable>
        <View style={styles.field}>
          <TextInput
            style={styles.input}
            placeholder={t("Message {name}", { name: displayRoomName(name) })}
            placeholderTextColor={colors.textFaint}
            value={content}
            onChangeText={setContent}
            onSubmitEditing={onSend}
            submitBehavior="submit"
            returnKeyType="send"
            multiline
            editable={!isUploading}
            accessibilityLabel={t("Message")}
          />
          <EmojiPicker
            onChange={(emoji) => setContent((c) => `${c}${emoji}`)}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Send message")}
          accessibilityState={{ disabled: !canSend }}
          onPress={onSend}
          disabled={!canSend}
          style={[styles.send, !canSend && styles.sendDisabled]}
        >
          <SendHorizontal
            size={20}
            color={canSend ? colors.primaryText : colors.textFaint}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space.xs,
  },
  error: { color: colors.danger, paddingHorizontal: space.sm },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  iconButton: {
    width: touch,
    height: touch,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: touch,
    paddingRight: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 15,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
  },
  send: {
    width: touch,
    height: touch,
    borderRadius: touch / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  sendDisabled: { backgroundColor: colors.surfaceRaised },
});
