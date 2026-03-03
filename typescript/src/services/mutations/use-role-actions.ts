"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/services/api-client";
import type { Role } from "@/services/api-client";

export function useCreateRole() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      data,
    }: {
      serverId: string;
      data: { name: string; color?: string; permissions?: number };
    }) => api.createRole(serverId, data),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["roles", serverId] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      roleId,
      data,
    }: {
      serverId: string;
      roleId: string;
      data: Partial<Role>;
    }) => api.updateRole(serverId, roleId, data),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["roles", serverId] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ serverId, roleId }: { serverId: string; roleId: string }) =>
      api.deleteRole(serverId, roleId),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["roles", serverId] });
    },
  });
}

export function useReorderRoles() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      roles,
    }: {
      serverId: string;
      roles: { id: string; position: number }[];
    }) => api.reorderRoles(serverId, roles),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["roles", serverId] });
    },
  });
}
