import { t } from "@nimchat/i18n";
import type { ReactNode } from "react";
import { useState } from "react";
import { Markdown } from "@/components/chat/markdown";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { overlayView, supported } from "@nimchat/brian";
import type { Block, Trust } from "@nimchat/brian";
import { usePendingCommand } from "@/lib/brian";
import {
  commandStorage,
  pluginCommands,
  usePluginCommands,
} from "@/lib/plugin-commands";
import { AgentStatus } from "./agent-status";
import { MonthlyBills } from "./monthly-bills";
import { ApprovalView } from "./plugins/approval-view";
import { ChecklistView } from "./plugins/checklist-view";
import { CommandStatus } from "./plugins/command-status";
import { CoreBlock } from "./plugins/core-block";
import { FormView } from "./plugins/form-view";
import { PollView } from "./plugins/poll-view";
import { styles } from "./plugins/styles";
import type { PluginViewProps } from "./plugins/types";
import { WorkflowView } from "./plugins/workflow-view";

// Renders one BRIAN block. For plugin blocks this is the full interactive
// surface, shown in the focus view; the timeline uses SurfaceReference.
interface BlockViewProps {
  block: Block;
  roomId: string;
  trust: Trust;
  interactive?: boolean;
  focus?: boolean;
  management?: ReactNode;
}
export function BlockView(props: BlockViewProps) {
  // Core blocks are static: render them without subscribing to room events.
  if (props.block.type !== "plugin" || !supported(props.block))
    return <CoreBlock block={props.block} />;
  return <PluginBlock {...props} />;
}
// Shared shell of every plugin card: optimistic view, command delivery and
// status. Each plugin's body lives in ./plugins.
function PluginBlock({
  block,
  roomId,
  trust,
  interactive = true,
  focus = false,
  management,
}: BlockViewProps) {
  const [error, setError] = useState("");
  const { pending, key } = usePendingCommand(roomId, block);
  const commands = usePluginCommands((s) => s.commands);
  const result = usePluginCommands((s) => s.results[key]);
  const own = commands.filter(
    (c) =>
      c.roomId === roomId &&
      c.plugin === block.plugin &&
      c.instanceId === block.instance_id,
  );
  const bills = block.plugin === "monthly_bills";
  const view = bills ? block.view : overlayView(block.view ?? {}, own);
  const send = async (command: string, payload: Block = {}, retry = false) => {
    try {
      await pluginCommands
        .getState()
        .send(roomId, block, command, payload, retry);
    } catch {
      setError(
        t("Could not store the command. Free up space and try again."),
      );
    }
  };
  const props: PluginViewProps = {
    view,
    userId: trust.userId,
    owner: view.owner_id === trust.userId,
    disabled:
      !interactive ||
      !!block.view.transfer ||
      (!!pending && !["checklist", "monthly_bills"].includes(block.plugin)),
    send,
  };
  if (block.plugin === "agent_status")
    return <AgentStatus block={block} roomId={roomId} trust={trust} />;
  return (
    <View style={[styles.card, focus && styles.focusCard]}>
      {!focus && <Text style={styles.title}>{view.title ?? block.plugin}</Text>}
      {!bills && !!view.description && (
        <Markdown text={String(view.description)} />
      )}
      {bills && (
        <MonthlyBills
          view={view}
          user={trust.userId}
          focus={focus}
          management={management}
          preferenceKey={JSON.stringify([
            "bills-group",
            trust.userId,
            roomId,
            block.instance_id,
          ])}
          storage={commandStorage}
          commands={own}
          result={result}
          onOpen={() =>
            router.push(
              `/rooms/${roomId}/surfaces/monthly_bills/${block.instance_id}` as any,
            )
          }
          send={(cmd, p, retry) =>
            pluginCommands.getState().send(roomId, block, cmd, p, retry)
          }
        />
      )}
      {block.plugin === "approval" && <ApprovalView {...props} />}
      {block.plugin === "workflow" && <WorkflowView {...props} />}
      {block.plugin === "checklist" && <ChecklistView {...props} />}
      {block.plugin === "poll" && <PollView {...props} />}
      {block.plugin === "form_stateful" && (
        <FormView
          {...props}
          result={result}
          revision={block.view?.revision}
          instanceId={block.instance_id}
        />
      )}
      <CommandStatus
        pending={pending}
        error={error}
        send={send}
        dismiss={() => pluginCommands.getState().dismiss(key)}
      />
    </View>
  );
}
