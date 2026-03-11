"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { CreateChannelData } from "@/shared/api/api-client";
import type { Channel } from "@/shared/model/types";

function collectDeletedChannelIds(channels: Channel[], channelId: string): Set<string> {
  const deletedIds = new Set<string>([channelId]);

  let foundChild = true;
  while (foundChild) {
    foundChild = false;
    for (const channel of channels) {
      if (
        channel.parentId !== null &&
        deletedIds.has(channel.parentId) &&
        !deletedIds.has(channel.id)
      ) {
        deletedIds.add(channel.id);
        foundChild = true;
      }
    }
  }

  return deletedIds;
}

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
    mutationFn: ({ channelId }: { serverId: string; channelId: string }) =>
      api.deleteChannel(channelId),
    onSuccess: (_, { serverId, channelId }) => {
      let deletedIds = new Set<string>([channelId]);
      queryClient.setQueryData<Channel[] | undefined>(["channels", serverId], (currentChannels) => {
        if (currentChannels === undefined) {
          return currentChannels;
        }

        deletedIds = collectDeletedChannelIds(currentChannels, channelId);
        return currentChannels.filter((channel) => !deletedIds.has(channel.id));
      });
      for (const deletedId of deletedIds) {
        queryClient.removeQueries({ queryKey: ["channel", deletedId], exact: true });
      }
      queryClient.invalidateQueries({ queryKey: ["channels", serverId] });
    },
  });
}
