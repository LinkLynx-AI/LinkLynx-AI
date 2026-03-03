"use client";

import { useSyncServerId } from "@/shared/model/hooks/use-sync-guild-params";

export function ServerSync({ serverId }: { serverId: string }) {
  useSyncServerId(serverId);
  return null;
}
