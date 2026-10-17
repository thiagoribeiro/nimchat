import { StyleSheet, Text, View } from "react-native";
import type { Surface, Trust } from "@nimchat/brian";
import { BlockView } from "@/components/brian/block-view";
import { ChatItem, when } from "./chat-item";
import { Avatar } from "@/components/ui/avatar";
import type { TimelineRow } from "@nimchat/brian/agent-timeline";
import { colors, space } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

export function AgentTurn({ row, surfaces, trust, reactions, highlighted }: {
  row: TimelineRow; surfaces: Map<string, Surface>; trust: Trust;
  reactions: Map<string, Map<string, number>>; highlighted?: boolean;
}) {
  if (!row.speaker) return <ChatItem event={row.events[0]} roomId={row.events[0].room_id}
    surfaces={surfaces} reactions={reactions.get(row.events[0].event_id)} highlighted={highlighted} />;
  const roomId = row.activities[0]?.roomId ?? row.events[0].room_id;
  return <View style={[styles.row, highlighted && styles.highlighted]}>
    <Avatar name={row.speaker.name} seed={row.speaker.id} size={36} />
    <View style={styles.content}>
      <View style={styles.header}><Text style={styles.sender}>{row.speaker.name}</Text>
        <Text style={type.caption}>{when(row.events[0]?.origin_server_ts ?? row.activities[0].activityAt)}</Text></View>
      {row.activities.map(surface => <BlockView key={surface.key} block={surface.block} roomId={roomId} trust={trust} />)}
      {row.events.map(event => <ChatItem key={event.event_id} event={event} roomId={roomId} surfaces={surfaces}
        reactions={reactions.get(event.event_id)} embedded />)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  content: { flex: 1 },
  header: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  sender: { fontFamily: font.semibold, fontSize: 14, color: colors.text, marginBottom: 2 },
  highlighted: { backgroundColor: colors.primarySoft },
});
