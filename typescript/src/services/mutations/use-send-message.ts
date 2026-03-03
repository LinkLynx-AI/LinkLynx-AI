"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/services/api-client";
import type { CreateMessageData } from "@/types/message";

export function useSendMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      channelId,
      data,
    }: {
      channelId: string;
      data: CreateMessageData;
    }) => api.sendMessage(channelId, data),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });
}
