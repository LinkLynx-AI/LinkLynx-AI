"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { CreateGuildData, UpdateGuildData } from "@/shared/api/api-client";
import type { Channel, Guild } from "@/shared/model/types";

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
    onSuccess: (_, serverId) => {
      queryClient.setQueryData<Guild[] | undefined>(["servers"], (currentServers) => {
        if (currentServers === undefined) {
          return currentServers;
        }

        return currentServers.filter((server) => server.id !== serverId);
      });
      queryClient.removeQueries({ queryKey: ["server", serverId], exact: true });

      const cachedChannels = queryClient.getQueryData<Channel[]>(["channels", serverId]) ?? [];
      for (const channel of cachedChannels) {
        queryClient.removeQueries({ queryKey: ["channel", channel.id], exact: true });
      }
      queryClient.removeQueries({ queryKey: ["channels", serverId], exact: true });

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

export function useUpdateServer() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ serverId, data }: { serverId: string; data: UpdateGuildData }) =>
      api.updateServer(serverId, data),
    onSuccess: (updatedServer) => {
      queryClient.setQueryData<Guild[] | undefined>(["servers"], (currentServers) => {
        if (currentServers === undefined) {
          return currentServers;
        }

        return currentServers.map((server) =>
          server.id === updatedServer.id ? { ...server, ...updatedServer } : server,
        );
      });
      queryClient.setQueryData(["server", updatedServer.id], updatedServer);
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["server", updatedServer.id] });
    },
  });
}
