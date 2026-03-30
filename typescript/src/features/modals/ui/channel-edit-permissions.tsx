"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Shield, Users } from "lucide-react";
import { RouteGuardScreen } from "@/features/route-guard";
import { useReplaceChannelPermissions } from "@/shared/api/mutations";
import type { ChannelPermissions, PermissionOverrideValue } from "@/shared/api/api-client";
import { toApiErrorText, toUpdateActionErrorText } from "@/shared/api/guild-channel-api-client";
import {
  getActionGuardScreenKind,
  useActionGuard,
  useChannelPermissions,
  useMembers,
  useRoles,
} from "@/shared/api/queries";
import { cn } from "@/shared/lib/cn";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const STATE_STYLES = {
  allow: "bg-discord-brand-green text-white",
  inherit: "bg-discord-interactive-muted text-white",
  deny: "bg-discord-brand-red text-white",
} as const;

type Subject =
  | {
      key: string;
      kind: "role";
      label: string;
      subtitle: string;
      roleKey: string;
      isSystem: boolean;
    }
  | {
      key: string;
      kind: "user";
      label: string;
      subtitle: string;
      userId: string;
    };

type OverrideDraft = {
  canView: PermissionOverrideValue;
  canPost: PermissionOverrideValue;
};

const DEFAULT_DRAFT: OverrideDraft = {
  canView: "inherit",
  canPost: "inherit",
};

function getRoleDisplayName(roleId: string, roleName: string): string {
  if (roleId === "member") {
    return "@everyone";
  }
  return roleName;
}

function buildDraftMap(permissions: ChannelPermissions | undefined) {
  return {
    role: Object.fromEntries(
      (permissions?.roleOverrides ?? []).map((override) => [
        override.roleKey,
        { canView: override.canView, canPost: override.canPost },
      ]),
    ) as Record<string, OverrideDraft>,
    user: Object.fromEntries(
      (permissions?.userOverrides ?? []).map((override) => [
        override.userId,
        { canView: override.canView, canPost: override.canPost },
      ]),
    ) as Record<string, OverrideDraft>,
  };
}

function hasConcreteOverride(draft: OverrideDraft): boolean {
  return draft.canView !== "inherit" || draft.canPost !== "inherit";
}

function PermissionToggle({
  value,
  onChange,
  label,
  description,
}: {
  value: PermissionOverrideValue;
  onChange: (value: PermissionOverrideValue) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-discord-divider py-3">
      <div className="flex-1 pr-4">
        <span className="text-sm text-discord-text-normal">{label}</span>
        <p className="mt-0.5 text-xs text-discord-text-muted">{description}</p>
      </div>
      <div className="flex gap-0.5 rounded-[3px] bg-discord-bg-tertiary p-0.5">
        {(["allow", "inherit", "deny"] as const).map((state) => (
          <button
            key={state}
            onClick={() => onChange(state)}
            aria-label={state === "allow" ? "許可" : state === "deny" ? "拒否" : "継承"}
            className={cn(
              "rounded-sm px-2 py-1 text-xs font-medium transition-colors",
              value === state
                ? STATE_STYLES[state]
                : "text-discord-text-muted hover:text-discord-text-normal",
            )}
          >
            {state === "allow" ? "許可" : state === "deny" ? "拒否" : "継承"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChannelEditPermissions({
  channelId,
  serverId,
}: {
  channelId?: string;
  serverId?: string;
}) {
  const addToast = useUIStore((state) => state.addToast);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, OverrideDraft>>({});
  const [userDrafts, setUserDrafts] = useState<Record<string, OverrideDraft>>({});
  const actionGuard = useActionGuard({
    serverId: serverId ?? "",
    channelId: channelId ?? null,
    requirement: "channel:manage",
    enabled: serverId !== undefined && channelId !== undefined,
  });
  const rolesQuery = useRoles(serverId ?? "");
  const membersQuery = useMembers(serverId ?? "");
  const permissionsQuery = useChannelPermissions(
    serverId ?? "",
    channelId ?? "",
    actionGuard.isAllowed,
  );
  const replaceChannelPermissions = useReplaceChannelPermissions();

  const subjects = useMemo<Subject[]>(() => {
    const roleSubjects = (rolesQuery.data ?? []).map<Subject>((role) => ({
      key: `role:${role.id}`,
      kind: "role",
      label: getRoleDisplayName(role.id, role.name),
      subtitle: role.isSystem ? "system role" : "role",
      roleKey: role.id,
      isSystem: role.isSystem,
    }));
    const userSubjects = (membersQuery.data ?? []).map<Subject>((member) => ({
      key: `user:${member.user.id}`,
      kind: "user",
      label: member.nick ?? member.user.displayName,
      subtitle: member.user.username,
      userId: member.user.id,
    }));
    return [...roleSubjects, ...userSubjects];
  }, [membersQuery.data, rolesQuery.data]);

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) {
      return subjects;
    }
    return subjects.filter((subject) => {
      return (
        subject.label.toLowerCase().includes(query) ||
        subject.subtitle.toLowerCase().includes(query)
      );
    });
  }, [search, subjects]);

  useEffect(() => {
    const draftMap = buildDraftMap(permissionsQuery.data);
    setRoleDrafts(draftMap.role);
    setUserDrafts(draftMap.user);
  }, [permissionsQuery.data]);

  useEffect(() => {
    if (subjects.length === 0) {
      setSelectedSubjectKey("");
      return;
    }
    if (
      selectedSubjectKey.length === 0 ||
      !subjects.some((subject) => subject.key === selectedSubjectKey)
    ) {
      setSelectedSubjectKey(subjects[0]?.key ?? "");
    }
  }, [selectedSubjectKey, subjects]);

  const selectedSubject = subjects.find((subject) => subject.key === selectedSubjectKey) ?? null;
  const currentDraft =
    selectedSubject === null
      ? DEFAULT_DRAFT
      : selectedSubject.kind === "role"
        ? (roleDrafts[selectedSubject.roleKey] ?? DEFAULT_DRAFT)
        : (userDrafts[selectedSubject.userId] ?? DEFAULT_DRAFT);

  const overrideCount = useMemo(() => {
    const roleCount = Object.values(roleDrafts).filter(hasConcreteOverride).length;
    const userCount = Object.values(userDrafts).filter(hasConcreteOverride).length;
    return roleCount + userCount;
  }, [roleDrafts, userDrafts]);

  function updateDraft(field: keyof OverrideDraft, value: PermissionOverrideValue) {
    if (selectedSubject === null) {
      return;
    }

    if (selectedSubject.kind === "role") {
      setRoleDrafts((current) => ({
        ...current,
        [selectedSubject.roleKey]: {
          ...(current[selectedSubject.roleKey] ?? DEFAULT_DRAFT),
          [field]: value,
        },
      }));
      return;
    }

    setUserDrafts((current) => ({
      ...current,
      [selectedSubject.userId]: {
        ...(current[selectedSubject.userId] ?? DEFAULT_DRAFT),
        [field]: value,
      },
    }));
  }

  const guardScreenKind = getActionGuardScreenKind(actionGuard.status);
  if (actionGuard.status === "loading") {
    return <p className="text-sm text-discord-text-muted">権限を確認中です...</p>;
  }

  if (guardScreenKind !== null) {
    return <RouteGuardScreen kind={guardScreenKind} />;
  }

  if (rolesQuery.isPending || membersQuery.isPending || permissionsQuery.isPending) {
    return <p className="text-sm text-discord-text-muted">権限オーバーライドを読み込み中です...</p>;
  }

  if (rolesQuery.isError) {
    return (
      <p className="text-sm text-discord-brand-red">
        {toApiErrorText(rolesQuery.error, "ロール一覧の読み込みに失敗しました。")}
      </p>
    );
  }

  if (membersQuery.isError) {
    return (
      <p className="text-sm text-discord-brand-red">
        {toApiErrorText(membersQuery.error, "メンバー一覧の読み込みに失敗しました。")}
      </p>
    );
  }

  if (permissionsQuery.isError) {
    return (
      <p className="text-sm text-discord-brand-red">
        {toApiErrorText(permissionsQuery.error, "権限オーバーライドの読み込みに失敗しました。")}
      </p>
    );
  }

  if (channelId === undefined || serverId === undefined) {
    return <p className="text-sm text-discord-text-muted">チャンネル情報を確認中です...</p>;
  }

  return (
    <div className="flex min-h-[360px] gap-4">
      <div className="w-[220px] shrink-0">
        <Input
          label="ロール / メンバー"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth
        />
        <div className="mt-3 rounded bg-discord-bg-secondary px-3 py-2 text-xs text-discord-text-muted">
          {overrideCount} 件の override が設定されています。
        </div>
        <div className="mt-3 space-y-1">
          {filteredSubjects.map((subject) => (
            <button
              key={subject.key}
              onClick={() => setSelectedSubjectKey(subject.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition-colors",
                subject.key === selectedSubjectKey
                  ? "bg-discord-bg-mod-selected text-discord-text-normal"
                  : "text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
              )}
            >
              {subject.kind === "role" ? (
                subject.roleKey === "member" ? (
                  <Users className="h-4 w-4 shrink-0" />
                ) : (
                  <Shield className="h-4 w-4 shrink-0" />
                )
              ) : (
                <Users className="h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate">{subject.label}</p>
                <p className="truncate text-xs text-discord-text-muted">{subject.subtitle}</p>
              </div>
            </button>
          ))}
          {filteredSubjects.length === 0 && (
            <div className="rounded bg-discord-bg-secondary px-3 py-4 text-center text-sm text-discord-text-muted">
              一致する対象がありません。
            </div>
          )}
        </div>
      </div>

      <div className="flex-1">
        {selectedSubject === null ? (
          <p className="text-sm text-discord-text-muted">左のリストから対象を選択してください。</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-discord-header-primary">
                {selectedSubject.label}
              </p>
              <p className="text-xs text-discord-text-muted">{selectedSubject.subtitle}</p>
            </div>

            <PermissionToggle
              value={currentDraft.canView}
              onChange={(value) => updateDraft("canView", value)}
              label="チャンネルを見る"
              description="閲覧可否を allow / deny / inherit で切り替えます。"
            />
            <PermissionToggle
              value={currentDraft.canPost}
              onChange={(value) => updateDraft("canPost", value)}
              label="メッセージを送信"
              description="投稿可否を allow / deny / inherit で切り替えます。"
            />

            {submitError !== null && (
              <p className="text-sm text-discord-brand-red">{submitError}</p>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={replaceChannelPermissions.isPending}
                onClick={async () => {
                  setSubmitError(null);
                  try {
                    await replaceChannelPermissions.mutateAsync({
                      serverId,
                      channelId,
                      data: {
                        roleOverrides: Object.entries(roleDrafts)
                          .map(([roleKey, draft]) => ({
                            roleKey,
                            canView: draft.canView,
                            canPost: draft.canPost,
                          }))
                          .filter((draft) => hasConcreteOverride(draft)),
                        userOverrides: Object.entries(userDrafts)
                          .map(([userId, draft]) => ({
                            userId,
                            canView: draft.canView,
                            canPost: draft.canPost,
                          }))
                          .filter((draft) => hasConcreteOverride(draft)),
                      },
                    });
                    addToast({ message: "チャンネル権限を保存しました。", type: "success" });
                  } catch (error: unknown) {
                    setSubmitError(
                      toUpdateActionErrorText(error, "チャンネル権限の保存に失敗しました。"),
                    );
                  }
                }}
              >
                {replaceChannelPermissions.isPending ? "保存中..." : "変更を保存"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
