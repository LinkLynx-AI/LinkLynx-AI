"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { Channel } from "@/shared/model/types";

export function useUpdateChannel() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ channelId, data }: { channelId: string; data: Partial<Channel> }) =>
      api.updateChannel(channelId, data),
    onSuccess: (updatedChannel) => {
      if (updatedChannel.guildId) {
        queryClient.invalidateQueries({
          queryKey: ["channels", updatedChannel.guildId],
        });
      }
    },
  });
}
