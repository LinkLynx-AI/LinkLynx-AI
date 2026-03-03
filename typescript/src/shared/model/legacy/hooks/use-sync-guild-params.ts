"use client";

import { useEffect } from "react";
import { useGuildStore } from "@/shared/model/legacy/stores/guild-store";

/**
 * Syncs URL params (serverId, channelId) to the guild Zustand store.
 * Call this in layout/page components that receive these params.
 */
export function useSyncServerId(serverId: string | null) {
  const setActiveServer = useGuildStore((s) => s.setActiveServer);

  useEffect(() => {
    setActiveServer(serverId);
  }, [serverId, setActiveServer]);
}

export function useSyncChannelId(channelId: string) {
  const setActiveChannel = useGuildStore((s) => s.setActiveChannel);

  useEffect(() => {
    setActiveChannel(channelId);
  }, [channelId, setActiveChannel]);
}
