import type { ReactNode } from "react";
import type { Block } from "@nimchat/brian";

export type Send = (command: string, payload?: Record<string, unknown>) => void;

// What every plugin view receives from PluginContent.
export interface PluginViewProps {
  view: Block;
  userId: string;
  owner: boolean;
  blocked: boolean;
  send: Send;
  setNotice: (notice: string) => void;
  action: (
    label: string,
    command: string,
    payload?: Record<string, unknown>,
    danger?: boolean
  ) => ReactNode;
}
