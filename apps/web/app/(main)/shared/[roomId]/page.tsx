"use client";
import { t } from "@nimchat/i18n";
import { isSharedRoom } from "@nimchat/brian";
import { useParams } from "next/navigation";
import { useChatStore } from "@nimchat/sdk";
import { useRoom, RoomProvider } from "@/components/chat/room-provider";
import { SurfaceFocus } from "@/components/brian/surface-focus";
function Content() {
  const { roomId, surfaces, status, hasMore, loadMore } = useRoom();
  const primary = [...surfaces.values()].filter(
    (s) =>
      s.block.view.shared?.room_id === roomId && !s.block.view.transfer
  );
  return primary.length === 1 ? (
    <SurfaceFocus
      plugin={primary[0].block.plugin}
      instanceId={primary[0].block.instance_id}
    />
  ) : (
    <div className="space-y-3 p-6">
      <p>
        {status === "loading"
          ? t("Loading surface…")
          : t("Surface unavailable. Refresh or load earlier history.")}
      </p>
      {hasMore && (
        <button onClick={() => void loadMore()}>
          {t("Load earlier history")}
        </button>
      )}
    </div>
  );
}
export default function SharedPage() {
  const params = useParams<{ roomId: string }>();
  const room = useChatStore((s) => s.rooms[params.roomId]);
  if (room?.state !== "join" || !isSharedRoom(room.name))
    return (
      <p className="p-6">
        {t("Accept the invitation in Surfaces to open this surface.")}
      </p>
    );
  return (
    <RoomProvider roomId={params.roomId}>
      <Content />
    </RoomProvider>
  );
}
