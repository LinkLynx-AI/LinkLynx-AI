"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { CreateRoleInput, Role, UpdateRoleInput } from "@/shared/api/api-client";

export function useCreateRole() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ serverId, data }: { serverId: string; data: CreateRoleInput }) =>
      api.createRole(serverId, data),
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
      data: UpdateRoleInput;
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
    mutationFn: ({ serverId, roleKeys }: { serverId: string; roleKeys: string[] }) =>
      api.reorderRoles(serverId, roleKeys),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["roles", serverId] });
    },
  });
}
