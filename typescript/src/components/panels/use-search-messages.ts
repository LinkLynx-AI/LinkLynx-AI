"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/services/api-client";
import type { SearchParams } from "@/services/api-client";

export function useSearchMessages(serverId: string, params: SearchParams) {
  return useQuery({
    queryKey: ["search", serverId, params],
    queryFn: () => getAPIClient().searchMessages(serverId, params),
    enabled: !!serverId && !!params.content,
  });
}
