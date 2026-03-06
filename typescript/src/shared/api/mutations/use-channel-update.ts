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
        queryClient.setQueryData<Channel[] | undefined>(
          ["channels", updatedChannel.guildId],
          (currentChannels) => {
            if (currentChannels === undefined) {
              return currentChannels;
            }

            const index = currentChannels.findIndex((channel) => channel.id === updatedChannel.id);
            if (index < 0) {
              return currentChannels;
            }

            const nextChannels = [...currentChannels];
            nextChannels[index] = {
              ...nextChannels[index],
              ...updatedChannel,
            };
            return nextChannels;
          },
        );
        queryClient.invalidateQueries({
          queryKey: ["channels", updatedChannel.guildId],
        });
      }

      queryClient.setQueryData<Channel | undefined>(["channel", updatedChannel.id], (current) => {
        if (current === undefined) {
          return updatedChannel;
        }
        return {
          ...current,
          ...updatedChannel,
        };
      });
    },
  });
}
