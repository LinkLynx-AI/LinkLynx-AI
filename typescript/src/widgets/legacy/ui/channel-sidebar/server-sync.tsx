"use client";

import { useSyncServerId } from "@/shared/model/legacy/hooks/use-sync-guild-params";

export function ServerSync({ serverId }: { serverId: string }) {
  useSyncServerId(serverId);
  return null;
}
