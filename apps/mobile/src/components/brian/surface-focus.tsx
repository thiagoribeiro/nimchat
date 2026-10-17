import { t } from "@nimchat/i18n";
import { SurfaceManagement } from "./surface-management";
import { instanceKey, pluginLabel, surfaceTitle } from "@nimchat/brian";
import { router } from "expo-router";
import {
  ChevronLeft,
  CornerUpLeft,
  Eye,
  EyeOff,
  Layers,
  Pin,
  PinOff,
} from "lucide-react-native";
import { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { v4 as uuid } from "uuid";

import { BlockView } from "@/components/brian/block-view";
import {
  displayRoomName,
  useOriginRequest,
  useRoom,
} from "@/components/chat/room-context";
import { goBackOr } from "@/components/chat/room-header";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBanner } from "@/components/ui/feedback";
import { PluginIcon } from "@/components/ui/plugin-icon";
import { StatusPill } from "@/components/ui/status";
import { useBrianRead, useRoomSurfaces } from "@/lib/brian";
import { getNimletClient } from "@/lib/nimlet";
import { routes } from "@/lib/routes";
import { colors, radius, space, touch } from "@/theme/tokens";
import { type } from "@/theme/typography";

// Focus view (UX Spec v2 §3.3): the surface gets the whole content area, with
// its origin conversation one tap away. No message composer here.
export function SurfaceFocus({
  roomId,
  plugin,
  instanceId,
  from,
}: {
  roomId: string;
  plugin: string;
  instanceId: string;
  from?: string;
}) {
  const { name, history } = useRoom();
  const { surfaces, trust } = useRoomSurfaces(roomId);
  const surface = surfaces.get(instanceKey(roomId, plugin, instanceId));
  const stoppedSearch = useRef(false);
  useEffect(() => {
    if (history.status === "loading") stoppedSearch.current = false;
    if (
      !surface &&
      history.status === "loaded" &&
      history.hasMore &&
      !history.isLoadingMore &&
      !stoppedSearch.current
    )
      void history.loadMore().then((loaded) => {
        if (!loaded) stoppedSearch.current = true;
      });
  }, [surface, history]);
  const originAttempt = useRef("");
  useEffect(() => {
    if (
      surface &&
      !surface.createdAt &&
      history.hasMore &&
      !history.isLoadingMore &&
      originAttempt.current !== surface.key
    ) {
      originAttempt.current = surface.key;
      void history.loadMore();
    }
  }, [surface, history]);
  const mark = useBrianRead((s) => s.mark);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Opening a surface marks only this surface as read.
  useEffect(() => {
    if (surface) mark(surface.key, surface.activity);
  }, [surface?.key, surface?.activity, mark]);

  const back = () =>
    surface?.block.view.shared
      ? router.replace("/?tab=shared" as any)
      : goBackOr(routes.room(roomId));
  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Back")}
        onPress={back}
        style={styles.back}
      >
        <ChevronLeft size={24} color={colors.textSecondary} />
      </Pressable>
      <View style={styles.flex}>
        <Text style={type.caption} numberOfLines={1}>
          {surface?.block.view.shared ? t("Shared") : displayRoomName(name)}{" "}
          · {pluginLabel(plugin)}
        </Text>
        <Text style={type.heading} numberOfLines={1} accessibilityRole="header">
          {surface ? surfaceTitle(surface) : pluginLabel(plugin)}
        </Text>
      </View>
    </View>
  );

  if (!surface) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        {header}
        {history.status === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.center}>
            <EmptyState
              icon={<Layers size={28} color={colors.textMuted} />}
              title={t("Surface unavailable")}
              description={t("It was not found in this conversation. It may have been removed or be outside the loaded history.")}
            />
            <Button
              label={t("Go to conversation")}
              onPress={() => router.replace(routes.room(roomId))}
            />
          </View>
        )}
      </SafeAreaView>
    );
  }

  const preference = async (userPin: boolean, dismissed: boolean) => {
    setSaving(true);
    setError("");
    try {
      await getNimletClient().sendEvent(
        roomId,
        "m.ui.surface.preference.updated",
        uuid(),
        {
          plugin: surface.block.plugin,
          instance_id: surface.block.instance_id,
          user_pin: userPin,
          dismissed,
        },
      );
    } catch {
      setError(t("Could not save the preference."));
    } finally {
      setSaving(false);
    }
  };

  // Back to the origin message: unwind to the room's timeline, which scrolls to
  // and highlights the card. Opened from the Surfaces tab, the timeline is
  // not underneath, so the tab is swapped after unwinding.
  const toOrigin = () => {
    useOriginRequest.getState().requestOrigin(roomId, surface.sourceEventId);
    if (router.canDismiss()) router.dismissAll();
    if (from === "surfaces") router.replace(routes.room(roomId));
  };

  const introduction = (
    <>
      <View style={styles.summary}>
        <PluginIcon plugin={plugin} size={48} />
        <View style={[styles.flex, styles.summaryText]}>
          <StatusPill view={surface.block.view} />
          {surface.userPin && <Text style={type.caption}>{t("Pinned by you")}</Text>}
          {surface.dismissed && (
            <Text style={type.caption}>{t("Hidden from the active list")}</Text>
          )}
        </View>
      </View>

      {!surface.createdAt && history.hasMore && (
        <Button
          label={t("Load creation date")}
          disabled={history.isLoadingMore}
          onPress={() => void history.loadMore()}
        />
      )}
      <SurfaceManagement surface={surface} user={trust.userId} />
    </>
  );
  const surfaceActions = (
    <>
      <Text style={[type.overline, styles.sectionTitle]}>
        {surface.block.view.shared ? t("On this surface") : t("In this conversation")}
      </Text>
      <View style={styles.actions}>
        {!surface.block.view.shared && (
          <Button
            label={t("View original message")}
            icon={<CornerUpLeft size={16} color={colors.textSecondary} />}
            onPress={toOrigin}
          />
        )}
        <Button
          label={surface.userPin ? t("Unpin") : t("Pin")}
          icon={
            surface.userPin ? (
              <PinOff size={16} color={colors.textSecondary} />
            ) : (
              <Pin size={16} color={colors.textSecondary} />
            )
          }
          loading={saving}
          onPress={() => void preference(!surface.userPin, surface.dismissed)}
        />
        <Button
          label={
            surface.dismissed
              ? t("Show in the active list")
              : t("Hide from the active list")
          }
          icon={
            surface.dismissed ? (
              <Eye size={16} color={colors.textSecondary} />
            ) : (
              <EyeOff size={16} color={colors.textSecondary} />
            )
          }
          disabled={saving}
          onPress={() => void preference(surface.userPin, !surface.dismissed)}
        />
      </View>
      {!!error && <ErrorBanner message={error} />}
      <Text style={[type.caption, styles.note]}>
        {t("Pinning and hiding only apply to you; they do not change the state or other participants' view.")}
      </Text>
    </>
  );
  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {plugin !== "monthly_bills" && introduction}
        <BlockView
          key={surface.key}
          block={surface.block}
          roomId={roomId}
          trust={trust}
          focus
          management={
            plugin === "monthly_bills" ? (
              <>
                {introduction}
                {surfaceActions}
              </>
            ) : undefined
          }
        />
        {plugin !== "monthly_bills" && surfaceActions}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
    paddingRight: space.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    width: touch,
    height: touch,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.lg,
  },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
  },
  summaryText: { gap: 4 },
  sectionTitle: { marginTop: space.md },
  actions: { gap: space.sm },
  note: { marginTop: space.xs },
});
