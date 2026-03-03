"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/services/api-client";

export function useWebhooks(channelId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["webhooks", channelId],
    queryFn: () => api.getWebhooks(channelId),
    enabled: !!channelId,
  });
}
