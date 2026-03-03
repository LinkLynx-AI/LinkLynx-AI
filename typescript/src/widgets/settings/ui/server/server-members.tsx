"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";
import { Avatar } from "@/shared/ui/legacy/avatar";
import { Button } from "@/shared/ui/legacy/button";
import { useMembers } from "@/shared/api/legacy/queries/use-members";
import type { GuildMember } from "@/shared/model/legacy/types/server";

const mockMembers: GuildMember[] = [];

const roleColors: Record<string, string> = {
  Admin: "#e74c3c",
  Moderator: "#3498db",
  Member: "#95a5a6",
};

export function ServerMembers({ serverId }: { serverId: string }) {
  const [search, setSearch] = useState("");
  const { data: apiMembers } = useMembers(serverId);
  const members = apiMembers ?? mockMembers;

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.user.username.toLowerCase().includes(q) ||
      m.user.displayName.toLowerCase().includes(q) ||
      (m.nick?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">メンバー</h2>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute top-1/2 left-3 -translate-y-1/2 text-discord-text-muted"
        />
        <input
          type="text"
          placeholder="メンバーを検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-[3px] bg-discord-input-bg pl-9 pr-3 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple"
        />
      </div>

      <div className="text-sm text-discord-text-muted mb-3">メンバー — {filtered.length}</div>

      <div>
        {filtered.map((member) => (
          <div
            key={member.user.id}
            className="group flex items-center gap-3 rounded px-3 py-2 hover:bg-discord-bg-mod-hover"
          >
            <Avatar
              src={member.avatar ?? member.user.avatar ?? undefined}
              alt={member.user.displayName}
              size={40}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-discord-text-normal">
                  {member.nick ?? member.user.displayName}
                </span>
                <span className="truncate text-xs text-discord-text-muted">
                  {member.user.username}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {member.roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: `${roleColors[role] ?? "#95a5a6"}20`,
                      color: roleColors[role] ?? "#95a5a6",
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: roleColors[role] ?? "#95a5a6" }}
                    />
                    {role}
                  </span>
                ))}
              </div>
            </div>
            <span className="hidden text-xs text-discord-text-muted sm:block">
              {new Date(member.joinedAt).toLocaleDateString("ja-JP")}
            </span>
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="secondary" size="sm">
                キック
              </Button>
              <Button variant="danger" size="sm">
                BAN
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
