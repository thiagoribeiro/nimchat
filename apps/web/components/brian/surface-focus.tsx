"use client";
import { t } from "@nimchat/i18n";
import { SurfaceManagement } from "./surface-management";
import {
  instanceKey,
  pluginLabel,
  surfaceTitle
} from "@nimchat/brian";
import { ChevronLeft, CornerUpLeft, EyeOff, Pin } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { v4 as uuid } from "uuid";
import { useRoom } from "@/components/chat/room-provider";
import { BlockView } from "@/components/brian/block-view";
import { getNimletClient } from "@/lib/nimlet";
export function SurfaceFocus({
  plugin,
  instanceId
}: {
  plugin: string;
  instanceId: string;
}) {
  const {
    roomId,
    surfaces,
    trust,
    status,
    hasMore,
    isLoadingMore,
    loadMore
  } = useRoom();
  const surface = surfaces.get(instanceKey(roomId, plugin, instanceId));
  const stoppedSearch = useRef(false);
  useEffect(() => {
    if (status === "loading") stoppedSearch.current = false;
    if (
      !surface &&
      status === "loaded" &&
      hasMore &&
      !isLoadingMore &&
      !stoppedSearch.current
    )
      void loadMore().then((loaded) => {
        if (!loaded) stoppedSearch.current = true;
      });
  }, [surface, status, hasMore, isLoadingMore, loadMore]);
  const originAttempt = useRef("");
  useEffect(() => {
    if (
      surface &&
      !surface.createdAt &&
      hasMore &&
      !isLoadingMore &&
      originAttempt.current !== surface.key
    ) {
      originAttempt.current = surface.key;
      void loadMore();
    }
  }, [surface, hasMore, isLoadingMore, loadMore]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const root = "/rooms/" + encodeURIComponent(roomId);
  const preference = async (pin: boolean, dismissed: boolean) => {
    if (!surface) return;
    setSaving(true);
    setError("");
    try {
      await getNimletClient().sendEvent(
        roomId,
        "m.ui.surface.preference.updated",
        uuid(),
        { plugin, instance_id: instanceId, user_pin: pin, dismissed }
      );
    } catch {
      setError(t("Could not save the preference."));
    } finally {
      setSaving(false);
    }
  };
  if (!surface)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-lg font-semibold">{t("Surface unavailable")}</h2>
        <p className="text-sm text-slate-400">
          {status === "loading"
            ? "Carregando..."
            : t("The instance is not in the loaded history.")}
        </p>
        <Link href={root + "/surfaces"} className="text-violet-300">
          {t("Back to surfaces")}
        </Link>
      </div>
    );

  const introduction = (
    <>
      {!surface.createdAt && hasMore && (
        <button
          className="min-h-[44px] text-violet-300"
          disabled={isLoadingMore}
          onClick={() => void loadMore()}
        >
          {t("Load creation date")}
        </button>
      )}
      <SurfaceManagement surface={surface} user={trust.userId} />
    </>
  );
  const surfaceActions = (
    <>
      <div className="flex flex-wrap gap-2 border-t border-[#26324A] pt-4">
        {!surface.block.view.shared && (
          <Link
            href={
              root +
              "?focusEvent=" +
              encodeURIComponent(surface.sourceEventId)
            }
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#1A2338] px-4 py-2 text-sm"
          >
            <CornerUpLeft size={17} /> {t("View origin")}
          </Link>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void preference(!surface.userPin, surface.dismissed)
          }
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#1A2338] px-4 py-2 text-sm"
        >
          <Pin size={16} />
          {surface.userPin ? t("Unpin") : t("Pin")}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void preference(surface.userPin, !surface.dismissed)
          }
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#1A2338] px-4 py-2 text-sm"
        >
          <EyeOff size={16} />
          {surface.dismissed ? t("Show") : t("Hide")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </>
  );
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href={
            surface?.block.view.shared
              ? "/?tab=shared"
              : root + "/surfaces"
          }
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-slate-300 hover:text-white"
        >
          <ChevronLeft size={18} />{" "}
          {surface.block.view.shared
            ? t("Surfaces")
            : t("Surfaces in this conversation")}
        </Link>
        <div>
          <p className="text-xs text-slate-400">{pluginLabel(plugin)}</p>
          <h2 className="text-xl font-semibold">
            {surfaceTitle(surface)}
          </h2>
        </div>
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
      </div>
    </div>
  );
}
