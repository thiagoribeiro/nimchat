import { useLocalSearchParams } from "expo-router";

import { SurfaceFocus } from "@/components/brian/surface-focus";
import { useRoom } from "@/components/chat/room-context";

export default function SurfaceFocusScreen() {
  const { roomId } = useRoom();
  const { plugin, instanceId, from } = useLocalSearchParams<{
    plugin: string;
    instanceId: string;
    from?: string;
  }>();
  return <SurfaceFocus roomId={roomId} plugin={plugin} instanceId={instanceId} from={from} />;
}
