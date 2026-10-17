import type { Trust } from "@nimchat/brian";

const ids = (value: string | undefined) => new Set((value ?? "").split(",").map(v=>v.trim()).filter(Boolean));
export function brianTrust(userId: string): Trust {
  return {userId, agents:ids(process.env.NEXT_PUBLIC_BRIAN_AGENT_IDS), publishers:ids(process.env.NEXT_PUBLIC_BRIAN_PUBLISHER_IDS)};
}
