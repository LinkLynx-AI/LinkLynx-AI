"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/legacy/api-client";

export function useFriends() {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["friends"],
    queryFn: () => api.getFriends(),
  });
}
