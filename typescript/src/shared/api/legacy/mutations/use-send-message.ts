"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/legacy/api-client";
import type { CreateMessageData } from "@/shared/model/legacy/types/message";

export function useSendMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ channelId, data }: { channelId: string; data: CreateMessageData }) =>
      api.sendMessage(channelId, data),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });
}
