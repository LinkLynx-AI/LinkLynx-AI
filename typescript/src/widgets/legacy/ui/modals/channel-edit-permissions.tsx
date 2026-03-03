"use client";

import { useState } from "react";
import { Plus, Shield, Users } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";

type Role = {
  id: string;
  name: string;
  color?: string;
};

type PermissionOverride = {
  id: string;
  label: string;
  state: "allow" | "deny" | "inherit";
};

const mockRoles: Role[] = [
  { id: "everyone", name: "@everyone" },
  { id: "mod", name: "Moderator", color: "#e74c3c" },
  { id: "member", name: "Member", color: "#3498db" },
];

const defaultPermissions: PermissionOverride[] = [
  { id: "send_messages", label: "メッセージを送信", state: "inherit" },
  { id: "manage_messages", label: "メッセージの管理", state: "inherit" },
  { id: "attach_files", label: "ファイルを添付", state: "inherit" },
  { id: "add_reactions", label: "リアクションの追加", state: "inherit" },
  { id: "manage_members", label: "メンバーを管理", state: "inherit" },
];

export function ChannelEditPermissions({ channelId }: { channelId?: string }) {
  const [selectedRole, setSelectedRole] = useState<string>("everyone");
  const [permissions, setPermissions] = useState<Record<string, PermissionOverride[]>>(() => {
    const map: Record<string, PermissionOverride[]> = {};
    for (const role of mockRoles) {
      map[role.id] = defaultPermissions.map((p) => ({ ...p }));
    }
    return map;
  });

  const currentPermissions = permissions[selectedRole] ?? [];

  const cycleState = (permId: string) => {
    setPermissions((prev) => {
      const rolePerms = prev[selectedRole] ?? [];
      return {
        ...prev,
        [selectedRole]: rolePerms.map((p) => {
          if (p.id !== permId) return p;
          const next = p.state === "inherit" ? "allow" : p.state === "allow" ? "deny" : "inherit";
          return { ...p, state: next };
        }),
      };
    });
  };

  return (
    <div className="flex gap-4 min-h-[300px]">
      {/* Left column: roles */}
      <div className="w-[180px] shrink-0 space-y-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-discord-header-secondary">
            ロール / メンバー
          </span>
          <button className="text-discord-interactive-normal hover:text-discord-interactive-hover">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {mockRoles.map((role) => (
          <button
            key={role.id}
            onClick={() => setSelectedRole(role.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors",
              selectedRole === role.id
                ? "bg-discord-bg-mod-selected text-discord-text-normal"
                : "text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
            )}
          >
            {role.id === "everyone" ? (
              <Users className="h-4 w-4 shrink-0" />
            ) : (
              <Shield
                className="h-4 w-4 shrink-0"
                style={role.color ? { color: role.color } : undefined}
              />
            )}
            <span className="truncate">{role.name}</span>
          </button>
        ))}
      </div>

      {/* Right column: permissions */}
      <div className="flex-1 space-y-2">
        <p className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
          権限オーバーライド
        </p>
        {currentPermissions.map((perm) => (
          <div
            key={perm.id}
            className="flex items-center justify-between rounded bg-discord-bg-secondary px-3 py-2"
          >
            <span className="text-sm text-discord-text-normal">{perm.label}</span>
            <button
              onClick={() => cycleState(perm.id)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                perm.state === "allow" && "bg-discord-brand-green/20 text-discord-brand-green",
                perm.state === "deny" && "bg-discord-brand-red/20 text-discord-brand-red",
                perm.state === "inherit" && "bg-discord-bg-tertiary text-discord-text-muted",
              )}
            >
              {perm.state === "allow" ? "許可" : perm.state === "deny" ? "拒否" : "継承"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
