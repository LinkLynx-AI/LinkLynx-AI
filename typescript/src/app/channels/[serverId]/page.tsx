"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useChannels } from "@/shared/api/queries/use-channels";

export default function ServerPage() {
  const router = useRouter();
  const params = useParams<{ serverId: string }>();
  const serverId = params.serverId;
  const { data: channels } = useChannels(serverId);

  useEffect(() => {
    if (!channels) return;
    // Find the first text channel (type 0)
    const firstTextChannel = channels
      .filter((c) => c.type === 0)
      .sort((a, b) => a.position - b.position)[0];

    if (firstTextChannel) {
      router.replace(`/channels/${serverId}/${firstTextChannel.id}`);
    }
  }, [channels, serverId, router]);

  return null;
}
