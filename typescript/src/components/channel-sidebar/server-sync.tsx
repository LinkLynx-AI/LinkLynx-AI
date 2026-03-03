"use client";

import { useSyncServerId } from "@/hooks/use-sync-guild-params";

export function ServerSync({ serverId }: { serverId: string }) {
  useSyncServerId(serverId);
  return null;
}
