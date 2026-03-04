"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { CreateChannelData } from "@/shared/api/api-client";
import type { Channel } from "@/shared/model/types";

export function useCreateChannel() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ serverId, data }: { serverId: string; data: CreateChannelData }) =>
      api.createChannel(serverId, data),
    onSuccess: (createdChannel, { serverId }) => {
      queryClient.setQueryData<Channel[] | undefined>(["channels", serverId], (currentChannels) => {
        if (currentChannels === undefined) {
          return currentChannels;
        }

        if (currentChannels.some((channel) => channel.id === createdChannel.id)) {
          return currentChannels;
        }

        return [...currentChannels, createdChannel];
      });
      queryClient.setQueryData(["channel", createdChannel.id], createdChannel);
      queryClient.invalidateQueries({ queryKey: ["channels", serverId] });
    },
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: (channelId: string) => api.deleteChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}
