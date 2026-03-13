"use client";

import { useState } from "react";
import { useMembers, useRoles, useUserProfile } from "@/shared/api/queries";
import type { Role as ApiRole } from "@/shared/api/api-client";
import { Modal } from "@/shared/ui/modal";
import { Tabs } from "@/shared/ui/tabs-simple";
import { Avatar } from "@/shared/ui/avatar";
import { ProfileBadges } from "./profile-badges";
import { RolePills } from "./role-pills";
import { useGuildStore } from "@/shared/model/stores/guild-store";
import type { Role } from "@/shared/model/types/server";

function numberToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function toServerRole(role: ApiRole): Role {
  return {
    id: role.id,
    name: role.name,
    color: 0,
    position: role.position,
    permissions: String(role.permissions),
    mentionable: role.mentionable,
    hoist: role.hoist,
    memberCount: role.memberCount,
  };
}

const profileTabs = [
  { id: "profile", label: "プロフィール" },
  { id: "mutual-servers", label: "共通のサーバー" },
  { id: "mutual-friends", label: "共通のフレンド" },
];

// Mock mutual servers data
const mockMutualServers: { id: string; name: string; icon: string | null }[] = [];

// Mock mutual friends data
const mockMutualFriends: {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  status: "online" | "idle" | "dnd" | "offline";
}[] = [];

export function ProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: profile } = useUserProfile(userId);
  const serverId = useGuildStore((s) => s.activeServerId);
  const { data: roles = [] } = useRoles(serverId ?? "");
  const { data: members = [] } = useMembers(serverId ?? "");
  const [activeTab, setActiveTab] = useState("profile");
  const [note, setNote] = useState("");

  if (!profile) return null;

  const serverRoles = roles.map(toServerRole);
  const memberData = members.find((member) => member.user.id === userId) ?? null;
  const memberRoleIds = memberData?.roles ?? [];
  const memberRoles: Role[] = serverRoles.filter((r) => memberRoleIds.includes(r.id));

  const bannerColor = profile.accentColor ? numberToHex(profile.accentColor) : "#5865f2";

  return (
    <Modal open onClose={onClose} className="max-w-[600px] overflow-hidden p-0">
      {/* Banner */}
      <div
        className="h-[200px]"
        style={
          profile.banner
            ? { backgroundImage: `url(${profile.banner})`, backgroundSize: "cover" }
            : { background: `linear-gradient(135deg, ${bannerColor}, ${bannerColor}88)` }
        }
      />

      {/* Avatar overlapping banner */}
      <div className="relative px-4">
        <div className="-mt-[60px] mb-2 inline-block rounded-full border-[6px] border-discord-bg-primary">
          <Avatar
            src={profile.avatar ?? undefined}
            alt={profile.displayName}
            size={128}
            status={profile.status}
          />
        </div>
      </div>

      {/* User info */}
      <div className="px-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-discord-header-primary">
              {profile.displayName}
            </div>
            <div className="text-sm text-discord-text-muted">{profile.username}</div>
          </div>
          {profile.badges.length > 0 && <ProfileBadges badges={profile.badges} />}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 px-4">
        <Tabs tabs={profileTabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab content */}
      <div className="max-h-[300px] overflow-y-auto px-4 py-4">
        {activeTab === "profile" && (
          <div className="space-y-4">
            {profile.bio && (
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-discord-header-secondary">
                  自己紹介
                </div>
                <p className="text-sm text-discord-text-normal">{profile.bio}</p>
              </div>
            )}

            <div>
              <div className="mb-1 text-xs font-bold uppercase text-discord-header-secondary">
                Discordに登録した日
              </div>
              <p className="text-sm text-discord-text-muted">
                {new Date(profile.createdAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {memberRoles.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-discord-header-secondary">
                  ロール
                </div>
                <RolePills roles={memberRoles} />
              </div>
            )}
          </div>
        )}

        {activeTab === "mutual-servers" && (
          <div className="space-y-1">
            {mockMutualServers.map((server) => (
              <div
                key={server.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-discord-bg-mod-hover"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-bg-tertiary text-xs font-medium text-discord-text-normal">
                  {server.name.charAt(0)}
                </div>
                <span className="text-sm text-discord-text-normal">{server.name}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "mutual-friends" && (
          <div className="space-y-1">
            {mockMutualFriends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-discord-bg-mod-hover"
              >
                <Avatar
                  src={friend.avatar ?? undefined}
                  alt={friend.displayName}
                  size={32}
                  status={friend.status}
                />
                <span className="text-sm text-discord-text-normal">{friend.displayName}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note section */}
      <div className="border-t border-discord-divider px-4 py-3">
        <div className="mb-1 text-xs font-bold uppercase text-discord-header-secondary">メモ</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="このユーザーについてメモを追加"
          className="w-full resize-none rounded bg-discord-input-bg px-2 py-1.5 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple"
          rows={2}
        />
      </div>
    </Modal>
  );
}
