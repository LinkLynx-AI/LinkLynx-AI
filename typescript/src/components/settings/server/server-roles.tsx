"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, Shield } from "lucide-react";
import { RoleEditPanel } from "./role-edit-panel";
import { mockRoles as initialMockRoles, type MockRole } from "@/services/mock/data/roles";

export function ServerRoles({ serverId }: { serverId: string }) {
  const [roles, setRoles] = useState<MockRole[]>(initialMockRoles);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  function handleCreateRole() {
    const newRole: MockRole = {
      id: `role-${Date.now()}`,
      name: "新しいロール",
      color: "#95a5a6",
      position: roles.length,
      permissions: 0,
      hoist: false,
      mentionable: false,
      memberCount: 0,
    };
    setRoles((prev) => [newRole, ...prev]);
    setSelectedRoleId(newRole.id);
  }

  function handleSaveRole(updated: MockRole) {
    setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
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
        <Button onClick={handleCreateRole} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          ロールを作成
        </Button>
      </div>

      <div className="flex gap-4">
        {/* Left - Role list */}
        <div className="w-[220px] shrink-0">
          <p className="mb-2 text-xs text-discord-text-muted">
            ロールをドラッグして順序を変更できます。上位のロールが優先されます。
          </p>
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
              <GripVertical className="h-4 w-4 shrink-0 text-discord-text-muted opacity-0 group-hover:opacity-100" />
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: role.color }}
              />
              <span className="flex-1 truncate text-left">{role.name}</span>
              {role.hoist && <Shield className="h-3 w-3 shrink-0 text-discord-text-muted" />}
              <span className="text-xs text-discord-text-muted">{role.memberCount}</span>
            </button>
          ))}
        </div>

        {/* Right - Role edit panel or placeholder */}
        {selectedRole ? (
          <RoleEditPanel
            role={selectedRole}
            onSave={handleSaveRole}
            onBack={() => setSelectedRoleId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Shield className="mx-auto mb-3 h-12 w-12 text-discord-text-muted" />
              <p className="text-sm text-discord-text-muted">
                左のリストからロールを選択して編集してください
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
