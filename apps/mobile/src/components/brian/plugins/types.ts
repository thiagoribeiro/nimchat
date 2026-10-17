import type { Block } from "@nimchat/brian";

export type Send = (
  command: string,
  payload?: Block,
  retry?: boolean,
) => Promise<void>;

// What every plugin view receives from PluginBlock.
export interface PluginViewProps {
  view: Block;
  userId: string;
  owner: boolean;
  disabled: boolean;
  send: Send;
}
