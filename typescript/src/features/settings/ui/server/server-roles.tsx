"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Shield } from "lucide-react";
import {
  useCreateRole,
  useDeleteRole,
  useReorderRoles,
  useReplaceMemberRoles,
  useUpdateRole,
} from "@/shared/api/mutations";
import {
  toCreateActionErrorText,
  toDeleteActionErrorText,
  toUpdateActionErrorText,
} from "@/shared/api/guild-channel-api-client";
import { useMembers, useRoles } from "@/shared/api/queries";
import { cn } from "@/shared/lib/cn";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { Button } from "@/shared/ui/button";
import { RoleEditPanel } from "./role-edit-panel";

function getRoleDisplayName(roleId: string, roleName: string): string {
  if (roleId === "member") {
    return "@everyone";
  }
  return roleName;
}

export function ServerRoles({ serverId }: { serverId: string }) {
  const addToast = useUIStore((state) => state.addToast);
  const rolesQuery = useRoles(serverId);
  const membersQuery = useMembers(serverId);
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const reorderRoles = useReorderRoles();
  const replaceMemberRoles = useReplaceMemberRoles();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const roles = useMemo(
    () =>
      [...(rolesQuery.data ?? [])].sort(
        (left, right) => right.position - left.position || left.name.localeCompare(right.name),
      ),
    [rolesQuery.data],
  );
  const members = membersQuery.data ?? [];

  useEffect(() => {
    if (roles.length === 0) {
      setSelectedRoleId(null);
      return;
    }
    if (selectedRoleId === null) {
      setSelectedRoleId(roles[0]?.id ?? null);
      return;
    }
    if (!roles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(roles[0]?.id ?? null);
    }
  }, [roles, selectedRoleId]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  async function handleCreateRole() {
    setCreateError(null);
    try {
      const created = await createRole.mutateAsync({
        serverId,
        data: {
          name: "新しいロール",
          allowView: true,
          allowPost: true,
          allowManage: false,
        },
      });
      setSelectedRoleId(created.id);
      addToast({ message: "ロールを作成しました。", type: "success" });
    } catch (error: unknown) {
      setCreateError(toCreateActionErrorText(error, "ロールの作成に失敗しました。"));
    }
  }

  async function handleMoveRole(roleId: string, direction: "up" | "down") {
    const customRoles = roles.filter((role) => !role.isSystem);
    const currentIndex = customRoles.findIndex((role) => role.id === roleId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= customRoles.length ||
      customRoles[targetIndex] === undefined
    ) {
      return;
    }

    const nextCustomRoles = [...customRoles];
    const [currentRole] = nextCustomRoles.splice(currentIndex, 1);
    if (currentRole === undefined) {
      return;
    }
    nextCustomRoles.splice(targetIndex, 0, currentRole);
    await reorderRoles.mutateAsync({
      serverId,
      roleKeys: nextCustomRoles.map((role) => role.id),
    });
    addToast({ message: "ロール順序を更新しました。", type: "success" });
  }

  if (rolesQuery.isPending || membersQuery.isPending) {
    return <p className="text-sm text-discord-text-muted">ロール設定を読み込み中です...</p>;
  }

  if (rolesQuery.isError) {
    return <p className="text-sm text-discord-brand-red">{rolesQuery.error.message}</p>;
  }

  if (membersQuery.isError) {
    return <p className="text-sm text-discord-brand-red">{membersQuery.error.message}</p>;
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-discord-header-primary">ロール</h2>
          <span className="rounded bg-discord-bg-secondary px-1.5 py-0.5 text-xs font-medium text-discord-text-muted">
            {roles.length}
          </span>
        </div>
        <Button onClick={() => void handleCreateRole()} size="sm" disabled={createRole.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />
          {createRole.isPending ? "作成中..." : "ロールを作成"}
        </Button>
      </div>

      <p className="mb-4 text-xs text-discord-text-muted">
        system role は固定されます。custom role だけを並び替えできます。
      </p>
      {createError !== null && <p className="mb-4 text-sm text-discord-brand-red">{createError}</p>}

      <div className="flex gap-4">
        <div className="w-[240px] shrink-0">
          <div className="space-y-1">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded px-2 py-2 text-sm transition-colors",
                  role.id === selectedRoleId
                    ? "bg-discord-bg-mod-active text-discord-interactive-active"
                    : "text-discord-interactive-normal hover:bg-discord-bg-mod-hover",
                )}
              >
                <Shield className="h-4 w-4 shrink-0 text-discord-text-muted" />
                <span className="flex-1 truncate text-left">
                  {getRoleDisplayName(role.id, role.name)}
                </span>
                {role.isSystem && (
                  <span className="rounded bg-discord-bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-discord-text-muted">
                    system
                  </span>
                )}
                <span className="text-xs text-discord-text-muted">{role.memberCount}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedRole !== null ? (
          <RoleEditPanel
            key={selectedRole.id}
            role={selectedRole}
            members={members}
            canMoveUp={
              !selectedRole.isSystem &&
              roles
                .filter((role) => !role.isSystem)
                .findIndex((role) => role.id === selectedRole.id) > 0
            }
            canMoveDown={
              !selectedRole.isSystem &&
              roles
                .filter((role) => !role.isSystem)
                .findIndex((role) => role.id === selectedRole.id) <
                roles.filter((role) => !role.isSystem).length - 1
            }
            onBack={() => setSelectedRoleId(null)}
            onSave={async (data) => {
              const updated = await updateRole.mutateAsync({
                serverId,
                roleId: selectedRole.id,
                data,
              });
              addToast({ message: "ロール設定を保存しました。", type: "success" });
              return updated;
            }}
            onDelete={
              selectedRole.isSystem
                ? null
                : async () => {
                    try {
                      await deleteRole.mutateAsync({ serverId, roleId: selectedRole.id });
                      addToast({ message: "ロールを削除しました。", type: "success" });
                      setSelectedRoleId(null);
                    } catch (error: unknown) {
                      throw new Error(
                        toDeleteActionErrorText(error, "ロールの削除に失敗しました。"),
                      );
                    }
                  }
            }
            onMove={async (direction) => {
              try {
                await handleMoveRole(selectedRole.id, direction);
              } catch (error: unknown) {
                throw new Error(toUpdateActionErrorText(error, "ロール順序の更新に失敗しました。"));
              }
            }}
            onUpdateMemberRoles={async (memberId, roleKeys) => {
              const uniqueRoleKeys = Array.from(new Set(roleKeys));
              await replaceMemberRoles.mutateAsync({
                serverId,
                memberId,
                roleKeys: uniqueRoleKeys,
              });
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Shield className="mx-auto mb-3 h-12 w-12 text-discord-text-muted" />
              <p className="text-sm text-discord-text-muted">
                左のリストからロールを選択して編集してください。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
