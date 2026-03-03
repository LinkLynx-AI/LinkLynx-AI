"use client";

import { useMemo } from "react";
import { useMembers } from "@/shared/api/legacy/queries";
import { useGuildStore } from "@/shared/model/legacy/stores/guild-store";
import { MemberCategory } from "./member-category";
import { MemberItem } from "./member-item";
import type { GuildMember, Role } from "@/shared/model/legacy/types/server";

function numberToHex(color: number): string {
  if (color === 0) return "";
  return `#${color.toString(16).padStart(6, "0")}`;
}

type MemberGroup = {
  role: Role;
  members: GuildMember[];
};

function groupMembersByRole(members: GuildMember[], roles: Role[]): MemberGroup[] {
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const hoistRoles = roles.filter((r) => r.hoist).sort((a, b) => b.position - a.position);

  const groups: Map<string, GuildMember[]> = new Map();
  const onlineUngrouped: GuildMember[] = [];

  for (const member of members) {
    const highestHoist = hoistRoles.find((r) => member.roles.includes(r.id));
    if (highestHoist) {
      const existing = groups.get(highestHoist.id) ?? [];
      existing.push(member);
      groups.set(highestHoist.id, existing);
    } else {
      onlineUngrouped.push(member);
    }
  }

  const result: MemberGroup[] = hoistRoles
    .filter((r) => groups.has(r.id))
    .map((r) => ({
      role: r,
      members: groups.get(r.id)!,
    }));

  if (onlineUngrouped.length > 0) {
    result.push({
      role: {
        id: "online",
        name: "Online",
        color: 0,
        position: 0,
        permissions: "0",
        mentionable: false,
        hoist: false,
        memberCount: onlineUngrouped.length,
      },
      members: onlineUngrouped,
    });
  }

  return result;
}

// Hardcoded roles for mock - will come from API later
import { mockRoles } from "@/shared/api/legacy/mock/data/servers";

export function MemberList() {
  const serverId = useGuildStore((s) => s.activeServerId);
  const { data: members } = useMembers(serverId ?? "");

  const roles = serverId ? (mockRoles[serverId] ?? []) : [];

  const groups = useMemo(() => {
    if (!members) return [];
    return groupMembersByRole(members, roles);
  }, [members, roles]);

  if (!serverId || !members) return null;

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-discord-bg-secondary">
      <div className="flex-1 overflow-y-auto px-2 pb-4" role="list">
        {groups.map((group) => (
          <MemberCategory key={group.role.id} name={group.role.name} count={group.members.length}>
            {group.members.map((member) => (
              <MemberItem
                key={member.user.id}
                member={member}
                roleColor={numberToHex(group.role.color)}
              />
            ))}
          </MemberCategory>
        ))}
      </div>
    </aside>
  );
}
