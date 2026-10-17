import { t } from "@nimchat/i18n";
import type { AttachmentContent } from "@nimchat/sdk";
import { FileText, X, Download } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { downloadAndShareAttachment } from "@/lib/media";
import { getNimletClient, getTokenStorage } from "@/lib/nimlet";
import { colors } from "@/theme/tokens";

export function AttachmentPreview({ content }: { content: AttachmentContent }) {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(
    content.width && content.height && content.width > 0 && content.height > 0
      ? content.width / content.height : 1.875,
  );
  const isImage = content.mimetype?.startsWith("image/") ?? false;

  useEffect(() => {
    getTokenStorage()
      .getToken()
      .then((token) => setHeaders(token ? { Authorization: `Bearer ${token}` } : {}));
  }, []);

  if (isImage) {
    const uri = getNimletClient().getMediaUrl(content.content_uri);
    return (
      <View style={styles.imageContainer}>
        <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel={t("Open image")}>
          <Image
            source={headers ? { uri, headers } : undefined}
            style={[styles.image, { aspectRatio }]}
            contentFit="contain"
            onLoad={(event) => {
              if (event.source.width > 0 && event.source.height > 0)
                setAspectRatio(event.source.width / event.source.height);
            }}
          />
        </Pressable>
        {!!content.caption && <Text style={styles.caption}>{content.caption}</Text>}
        <Modal visible={expanded} onRequestClose={() => setExpanded(false)} animationType="fade">
          <View style={styles.viewer}>
            <View style={styles.toolbar}>
              <Pressable onPress={() => setExpanded(false)} accessibilityRole="button" accessibilityLabel={t("Close image")} hitSlop={12}>
                <X size={26} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => downloadAndShareAttachment(content.content_uri, content.filename ?? "image.png").catch(console.error)} accessibilityRole="button" accessibilityLabel={t("Save or share image")} hitSlop={12}>
                <Download size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Image source={headers ? { uri, headers } : undefined} style={styles.fullImage} contentFit="contain" />
            {!!content.caption && <Text style={styles.viewerCaption}>{content.caption}</Text>}
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <Pressable
      style={styles.fileRow}
      onPress={() => downloadAndShareAttachment(content.content_uri, content.filename ?? "file")}
    >
      <FileText size={20} color={colors.link} />
      <Text style={styles.fileName}>{content.filename ?? t("Download")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageContainer: { width: "100%", maxWidth: 480, marginTop: 6 },
  image: { width: "100%", borderRadius: 8, backgroundColor: colors.surfaceSunken },
  caption: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
  viewer: { flex: 1, backgroundColor: colors.surfaceSunken, paddingTop: 40, paddingBottom: 24 },
  toolbar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 12 },
  fullImage: { flex: 1, width: "100%" },
  viewerCaption: { color: colors.textSecondary, textAlign: "center", padding: 16 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceSunken,
  },
  fileName: { color: colors.link, fontSize: 13 },
});
