"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar } from "@/shared/ui/avatar";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { useGuildStore } from "@/shared/model/stores/guild-store";
import { useUserProfile } from "@/shared/api/queries/use-user-profile";
import { ProfileBadges } from "./profile-badges";
import { RolePills } from "./role-pills";
import { mockRoles, mockMembers } from "@/shared/api/mock/data/servers";
import type { Role } from "@/shared/model/types/server";

function numberToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function ProfilePopout() {
  const popout = useUIStore((s) => s.profilePopout);
  const hideProfilePopout = useUIStore((s) => s.hideProfilePopout);
  const serverId = useGuildStore((s) => s.activeServerId);
  const { data: profile } = useUserProfile(popout?.userId ?? null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popout) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        hideProfilePopout();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideProfilePopout();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [popout, hideProfilePopout]);

  if (!popout || !profile) return null;

  // Get member roles for this server
  const serverRoles = serverId ? (mockRoles[serverId] ?? []) : [];
  const memberData = serverId
    ? (mockMembers[serverId] ?? []).find((m) => m.user.id === popout.userId)
    : null;
  const memberRoleIds = memberData?.roles ?? [];
  const memberRoles: Role[] = serverRoles.filter((r) => memberRoleIds.includes(r.id));

  const bannerColor = profile.accentColor ? numberToHex(profile.accentColor) : "#5865f2";

  // Clamp position to viewport
  const top = Math.min(
    Math.max(popout.position.y, 8),
    typeof window !== "undefined" ? window.innerHeight - 450 : 300,
  );
  const left = Math.max(popout.position.x, 8);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[300px] overflow-hidden rounded-lg bg-discord-bg-floating shadow-xl"
      style={{ top, left }}
      role="dialog"
      aria-label="User Profile"
    >
      {/* Banner */}
      <div
        className="h-[60px]"
        style={
          profile.banner
            ? { backgroundImage: `url(${profile.banner})`, backgroundSize: "cover" }
            : { backgroundColor: bannerColor }
        }
      />

      {/* Avatar */}
      <div className="relative px-4">
        <div className="-mt-8 mb-2 inline-block rounded-full border-[6px] border-discord-bg-floating">
          <Avatar
            src={profile.avatar ?? undefined}
            alt={profile.displayName}
            size={80}
            status={profile.status}
          />
        </div>
      </div>

      {/* User info */}
      <div className="px-4 pb-4">
        <div className="mb-3 rounded-lg bg-discord-bg-tertiary p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-discord-header-primary">
                {profile.displayName}
              </div>
              <div className="text-sm text-discord-text-normal">{profile.username}</div>
            </div>
            {profile.badges.length > 0 && <ProfileBadges badges={profile.badges} />}
          </div>

          {profile.bio && (
            <>
              <div className="my-2 h-px bg-discord-divider" />
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-discord-header-primary">
                  About Me
                </div>
                <p className="text-sm text-discord-text-normal">{profile.bio}</p>
              </div>
            </>
          )}

          {memberRoles.length > 0 && (
            <>
              <div className="my-2 h-px bg-discord-divider" />
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-discord-header-primary">
                  Roles
                </div>
                <RolePills roles={memberRoles} />
              </div>
            </>
          )}

          <div className="my-2 h-px bg-discord-divider" />
          <div>
            <div className="mb-1 text-xs font-bold uppercase text-discord-header-primary">
              Member Since
            </div>
            <p className="text-sm text-discord-text-muted">
              {new Date(profile.createdAt).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Notes */}
          <div className="my-2 h-px bg-discord-divider" />
          <NoteSection />
        </div>
      </div>
    </div>
  );
}

function NoteSection() {
  const [note, setNote] = useState("");

  return (
    <div>
      <div className="mb-1 text-xs font-bold uppercase text-discord-header-primary">ノート</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="このユーザーのノートを追加..."
        rows={2}
        className="w-full resize-none rounded-md bg-discord-bg-secondary px-2 py-1.5 text-xs text-discord-text-normal placeholder:text-discord-text-muted outline-none"
      />
    </div>
  );
}
