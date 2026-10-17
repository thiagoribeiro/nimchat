import { t } from "@nimchat/i18n";
import { router } from "expo-router";
import { Linking, Text, View } from "react-native";
import { fallback, referenceTarget, supported } from "@nimchat/brian";
import type { Block } from "@nimchat/brian";
import { useChatStore } from "@nimchat/sdk";
import { AttachmentPreview } from "@/components/chat/attachment-preview";
import { Markdown } from "@/components/chat/markdown";
import { Button } from "./button";
import { styles } from "./styles";

// Static BRIAN blocks: markdown, references, media, key/value and notices.
export function CoreBlock({ block }: { block: Block }) {
  const rooms = useChatStore((s) => s.rooms);
  if (block.type === "reference") {
    const target = referenceTarget(block);
    return (
      <View>
        <Text style={styles.body}>{t(block.title)}</Text>
        {target && rooms[target.roomId]?.state === "join" ? (
          <Button
            label={t("Open surface")}
            action={() =>
              router.push(
                `/rooms/${target.roomId}/surfaces/${target.plugin}/${target.instanceId}` as any,
              )
            }
          />
        ) : (
          <Text style={styles.body}>
            {t("Join the shared surface to open it.")}
          </Text>
        )}
      </View>
    );
  }

  if (!supported(block)) return <Markdown text={fallback(block)} />;
  if (block.type === "markdown") return <Markdown text={String(block.text)} />;
  if (block.type === "divider") return <View style={styles.divider} />;
  if (block.type === "key_value")
    return (
      <View>
        {block.items.map((item: Block, index: number) => (
          <Text key={index} style={styles.body}>
            {item.key}: {String(item.value ?? "—")}
          </Text>
        ))}
      </View>
    );
  if (block.type === "actions")
    return <Text style={styles.body}>{t("Actions are not available in this version.")}</Text>;
  if (["reference", "file", "image", "audio"].includes(block.type)) {
    const uri = block.uri ?? block.url;
    if (
      typeof uri === "string" &&
      uri.startsWith("mxc://") &&
      ["image", "file"].includes(block.type)
    )
      return (
        <AttachmentPreview
          content={{
            content_uri: uri,
            filename: block.filename ?? block.alt ?? t("Media"),
            mimetype:
              block.mime_type ??
              (block.type === "image" ? "image/*" : undefined),
          }}
        />
      );
    const safe = typeof uri === "string" && /^https?:\/\//.test(uri);
    return (
      <View>
        <Text style={styles.body}>
          {block.title ?? block.alt ?? block.filename ?? block.type}
        </Text>
        {safe && (
          <Button
            label={t("Open")}
            action={() => {
              void Linking.openURL(uri);
            }}
          />
        )}
      </View>
    );
  }
  return (
    <Text
      selectable
      style={[styles.body, block.type === "notice" && styles.notice]}
    >
      {block.text ?? block.message ?? fallback(block)}
    </Text>
  );
}
