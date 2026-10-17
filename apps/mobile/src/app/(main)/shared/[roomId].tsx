import { t } from "@nimchat/i18n";
import { isSharedRoom } from "@nimchat/brian";
import { useChatStore } from "@nimchat/sdk";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  RoomProvider,
  useRoomHistoryLoader,
} from "@/components/chat/room-context";
import { SurfaceFocus } from "@/components/brian/surface-focus";
import { Button } from "@/components/ui/button";
import { useRoomSurfaces } from "@/lib/brian";
import { colors } from "@/theme/tokens";
export default function SharedPage() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const room = useChatStore((s) => s.rooms[roomId]);
  const access = room?.state === "join" && isSharedRoom(room.name);
  const history = useRoomHistoryLoader(access ? roomId : "");
  const { surfaces } = useRoomSurfaces(roomId);
  const ss = [...surfaces.values()].filter(
    (s) => s.block.view.shared?.room_id === roomId && !s.block.view.transfer,
  );
  if (!access)
    return (
      <SafeAreaView>
        <Text style={{ color: colors.text }}>
          {t("Accept the invitation in Surfaces to open it.")}
        </Text>
      </SafeAreaView>
    );
  return (
    <RoomProvider value={{ roomId, name: room.name, history }}>
      {ss.length === 1 ? (
        <SurfaceFocus
          roomId={roomId}
          plugin={ss[0].block.plugin}
          instanceId={ss[0].block.instance_id}
        />
      ) : (
        <View style={{ padding: 24 }}>
          <Text style={{ color: colors.text }}>{history.status === "loading" ? t("Loading surface…") : history.status === "error" ? t("Could not load the surface.") : t("The surface publication is not available yet.")}</Text>
          <Button label={t("Try loading again")} onPress={() => void history.reload()} />
          {history.hasMore && (
            <Button
              label={t("Load earlier history")}
              onPress={() => void history.loadMore()}
            />
          )}
        </View>
      )}
    </RoomProvider>
  );
}
