import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SurfaceList } from "@/components/brian/surface-list";
import { useRoom } from "@/components/chat/room-context";
import { RoomHeader } from "@/components/chat/room-header";
import { colors } from "@/theme/tokens";

// Surfaces tab: the working set of this conversation only.
export default function RoomSurfacesScreen() {
  const { roomId, name } = useRoom();
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <RoomHeader roomId={roomId} name={name} tab="surfaces" />
      <SurfaceList roomId={roomId} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
});
