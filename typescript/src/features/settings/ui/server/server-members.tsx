"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useReplaceMemberRoles } from "@/shared/api/mutations";
import { toUpdateActionErrorText } from "@/shared/api/guild-channel-api-client";
import { useMembers, useRoles } from "@/shared/api/queries";
import type { GuildMember } from "@/shared/model/types/server";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";

function getRoleDisplayName(roleId: string, roleName: string): string {
  if (roleId === "member") {
    return "@everyone";
  }
  return roleName;
}

function getMemberDisplayName(member: GuildMember): string {
  return member.nick ?? member.user.displayName;
}

export function ServerMembers({ serverId }: { serverId: string }) {
  const addToast = useUIStore((state) => state.addToast);
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [draftRoleKeys, setDraftRoleKeys] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    data: apiMembers = [],
    isPending: isMembersPending,
    isError,
    error,
  } = useMembers(serverId);
  const {
    data: roles = [],
    isPending: isRolesPending,
    isError: isRolesError,
    error: rolesError,
  } = useRoles(serverId);
  const replaceMemberRoles = useReplaceMemberRoles();

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return apiMembers.filter((member) => {
      if (query.length === 0) {
        return true;
      }
      return (
        member.user.username.toLowerCase().includes(query) ||
        member.user.displayName.toLowerCase().includes(query) ||
        (member.nick?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [apiMembers, search]);

  const selectedMember =
    filteredMembers.find((member) => member.user.id === selectedMemberId) ??
    apiMembers.find((member) => member.user.id === selectedMemberId) ??
    null;

  useEffect(() => {
    if (apiMembers.length === 0) {
      setSelectedMemberId(null);
      return;
    }
    if (
      selectedMemberId === null ||
      !apiMembers.some((member) => member.user.id === selectedMemberId)
    ) {
      setSelectedMemberId(apiMembers[0]?.user.id ?? null);
    }
  }, [apiMembers, selectedMemberId]);

  useEffect(() => {
    if (selectedMember !== null) {
      setDraftRoleKeys(selectedMember.roles);
    }
  }, [selectedMember]);

  if (isMembersPending || isRolesPending) {
    return <p className="text-sm text-discord-text-muted">メンバー設定を読み込み中です...</p>;
  }

  if (isError) {
    return <p className="text-sm text-discord-brand-red">{error.message}</p>;
  }

  if (isRolesError) {
    return <p className="text-sm text-discord-brand-red">{rolesError.message}</p>;
  }

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">メンバー</h2>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-discord-text-muted"
        />
        <input
          type="text"
          placeholder="メンバーを検索"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 w-full rounded-[3px] bg-discord-input-bg pl-9 pr-3 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple"
        />
      </div>

      <div className="text-sm text-discord-text-muted mb-3">
        メンバー - {filteredMembers.length}
      </div>

      <div className="flex gap-4">
        <div className="w-[320px] shrink-0 space-y-1">
          {filteredMembers.map((member) => (
            <button
              key={member.user.id}
              onClick={() => {
                setSelectedMemberId(member.user.id);
                setSubmitError(null);
              }}
              className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors ${
                selectedMemberId === member.user.id
                  ? "bg-discord-bg-mod-active"
                  : "hover:bg-discord-bg-mod-hover"
              }`}
            >
              <Avatar
                src={member.avatar ?? member.user.avatar ?? undefined}
                alt={member.user.displayName}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-discord-text-normal">
                  {getMemberDisplayName(member)}
                </div>
                <div className="truncate text-xs text-discord-text-muted">
                  {member.user.username}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1">
          {selectedMember === null ? (
            <p className="text-sm text-discord-text-muted">
              左のリストからメンバーを選択してください。
            </p>
          ) : (
            <div className="rounded-lg bg-discord-bg-secondary p-4">
              <div className="mb-4 flex items-center gap-3">
                <Avatar
                  src={selectedMember.avatar ?? selectedMember.user.avatar ?? undefined}
                  alt={selectedMember.user.displayName}
                  size={40}
                />
                <div>
                  <p className="text-base font-semibold text-discord-text-normal">
                    {getMemberDisplayName(selectedMember)}
                  </p>
                  <p className="text-sm text-discord-text-muted">{selectedMember.user.username}</p>
                </div>
              </div>

              <p className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
                ロール割当
              </p>
              <div className="space-y-2">
                {roles.map((role) => {
                  const checked = draftRoleKeys.includes(role.id);
                  const isLockedMemberRole = role.id === "member";

                  return (
                    <div
                      key={role.id}
                      className="flex items-center gap-3 rounded bg-discord-bg-tertiary px-3 py-2"
                    >
                      <Checkbox
                        checked={checked || isLockedMemberRole}
                        disabled={replaceMemberRoles.isPending || isLockedMemberRole}
                        onChange={(nextChecked) => {
                          setDraftRoleKeys((current) => {
                            const set = new Set(current);
                            if (nextChecked) {
                              set.add(role.id);
                            } else {
                              set.delete(role.id);
                            }
                            set.add("member");
                            return Array.from(set);
                          });
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-discord-text-normal">
                          {getRoleDisplayName(role.id, role.name)}
                        </p>
                        <p className="text-xs text-discord-text-muted">
                          {role.allowManage ? "Manage" : role.allowPost ? "Post" : "View"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {submitError !== null && (
                <p className="mt-4 text-sm text-discord-brand-red">{submitError}</p>
              )}

              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  disabled={
                    replaceMemberRoles.isPending ||
                    selectedMember.roles.slice().sort().join(",") ===
                      draftRoleKeys.slice().sort().join(",")
                  }
                  onClick={async () => {
                    setSubmitError(null);
                    try {
                      await replaceMemberRoles.mutateAsync({
                        serverId,
                        memberId: selectedMember.user.id,
                        roleKeys: Array.from(new Set([...draftRoleKeys, "member"])),
                      });
                      addToast({ message: "メンバーのロールを更新しました。", type: "success" });
                    } catch (updateError: unknown) {
                      setSubmitError(
                        toUpdateActionErrorText(
                          updateError,
                          "メンバーのロール更新に失敗しました。",
                        ),
                      );
                    }
                  }}
                >
                  {replaceMemberRoles.isPending ? "保存中..." : "ロールを保存"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
