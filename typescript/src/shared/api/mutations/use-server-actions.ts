"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { CreateGuildData } from "@/shared/api/api-client";
import type { Guild } from "@/shared/model/types";

export function useCreateServer() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: (data: CreateGuildData) => api.createServer(data),
    onSuccess: (createdServer) => {
      queryClient.setQueryData<Guild[] | undefined>(["servers"], (currentServers) => {
        if (currentServers === undefined) {
          return currentServers;
        }

        if (currentServers.some((server) => server.id === createdServer.id)) {
          return currentServers;
        }

        return [...currentServers, createdServer];
      });
      queryClient.setQueryData(["server", createdServer.id], createdServer);
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: (serverId: string) => api.deleteServer(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}

export function useLeaveServer() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: (serverId: string) => api.leaveServer(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}
