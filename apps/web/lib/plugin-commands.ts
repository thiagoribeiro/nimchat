"use client";
import { useStore } from "zustand";
import { v4 as uuid } from "uuid";
import { createPluginCommandStore } from "./plugin-command-state";

export const pluginCommands = createPluginCommandStore(uuid);
export function usePluginCommands<T>(selector: (state: ReturnType<typeof pluginCommands.getState>) => T): T {
  return useStore(pluginCommands, selector);
}
