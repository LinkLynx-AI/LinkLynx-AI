"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Shield, Trash2, Users } from "lucide-react";
import type { Role, UpdateRoleInput } from "@/shared/api/api-client";
import {
  toDeleteActionErrorText,
  toUpdateActionErrorText,
} from "@/shared/api/guild-channel-api-client";
import type { GuildMember } from "@/shared/model/types";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Tabs } from "@/shared/ui/tabs-simple";
import { Toggle } from "@/shared/ui/toggle";

type RoleEditTab = "display" | "permissions" | "members";

const TABS: { id: RoleEditTab; label: string }[] = [
  { id: "display", label: "表示" },
  { id: "permissions", label: "権限" },
  { id: "members", label: "メンバー" },
];

const ROLE_PERMISSION_FIELDS = [
  {
    key: "allowView",
    label: "閲覧を許可",
    description: "サーバーやチャンネルを表示できる基礎権限です。",
  },
  {
    key: "allowPost",
    label: "投稿を許可",
    description: "メッセージ送信やリアクションなど投稿系の基礎権限です。",
  },
  {
    key: "allowManage",
    label: "管理を許可",
    description: "設定、ロール、権限制御など管理系操作を許可します。",
  },
] as const;

type RolePermissionField = (typeof ROLE_PERMISSION_FIELDS)[number]["key"];

function getRoleDisplayName(role: Role): string {
  if (role.id === "member") {
    return "@everyone";
  }
  return role.name;
}

function getMemberDisplayName(member: GuildMember): string {
  return member.nick ?? member.user.displayName;
}

export function RoleEditPanel({
  role,
  members,
  canMoveUp,
  canMoveDown,
  onBack,
  onSave,
  onDelete,
  onMove,
  onUpdateMemberRoles,
}: {
  role: Role;
  members: GuildMember[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onBack: () => void;
  onSave: (input: UpdateRoleInput) => Promise<Role>;
  onDelete: (() => Promise<void>) | null;
  onMove: (direction: "up" | "down") => Promise<void>;
  onUpdateMemberRoles: (memberId: string, roleKeys: string[]) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<RoleEditTab>("display");
  const [name, setName] = useState(role.name);
  const [allowView, setAllowView] = useState(role.allowView);
  const [allowPost, setAllowPost] = useState(role.allowPost);
  const [allowManage, setAllowManage] = useState(role.allowManage);
  const [memberSearch, setMemberSearch] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return members
      .filter((member) => {
        if (query.length === 0) {
          return true;
        }
        return (
          getMemberDisplayName(member).toLowerCase().includes(query) ||
          member.user.username.toLowerCase().includes(query)
        );
      })
      .sort((left, right) => getMemberDisplayName(left).localeCompare(getMemberDisplayName(right)));
  }, [memberSearch, members]);

  const hasChanges =
    name.trim() !== role.name ||
    allowView !== role.allowView ||
    allowPost !== role.allowPost ||
    allowManage !== role.allowManage;
  const isBusy = isSaving || isDeleting || isReordering || pendingMemberId !== null;

  async function handleSave() {
    const normalizedName = name.trim();
    if (normalizedName.length === 0) {
      setSubmitError("ロール名を入力してください。");
      setSaveSuccessMessage(null);
      return;
    }

    setIsSaving(true);
    setSubmitError(null);
    setSaveSuccessMessage(null);
    try {
      await onSave({
        name: normalizedName,
        allowView,
        allowPost,
        allowManage,
      });
      setSaveSuccessMessage("ロール設定を保存しました。");
    } catch (error: unknown) {
      setSubmitError(toUpdateActionErrorText(error, "ロール設定の保存に失敗しました。"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (onDelete === null) {
      return;
    }

    setIsDeleting(true);
    setSubmitError(null);
    setSaveSuccessMessage(null);
    try {
      await onDelete();
    } catch (error: unknown) {
      setSubmitError(toDeleteActionErrorText(error, "ロールの削除に失敗しました。"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleMove(direction: "up" | "down") {
    setIsReordering(true);
    setSubmitError(null);
    setSaveSuccessMessage(null);
    try {
      await onMove(direction);
    } catch (error: unknown) {
      setSubmitError(toUpdateActionErrorText(error, "ロール順序の更新に失敗しました。"));
    } finally {
      setIsReordering(false);
    }
  }

  async function handleMemberToggle(member: GuildMember, checked: boolean) {
    const hasRole = member.roles.includes(role.id);
    if (hasRole === checked) {
      return;
    }

    setPendingMemberId(member.user.id);
    setSubmitError(null);
    setSaveSuccessMessage(null);
    try {
      const nextRoleKeys = checked
        ? [...member.roles, role.id]
        : member.roles.filter((roleKey) => roleKey !== role.id);
      await onUpdateMemberRoles(member.user.id, nextRoleKeys);
    } catch (error: unknown) {
      setSubmitError(toUpdateActionErrorText(error, "メンバー権限の更新に失敗しました。"));
    } finally {
      setPendingMemberId(null);
    }
  }

  return (
    <div className="flex-1">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-discord-text-link hover:underline"
            aria-label="戻る"
          >
            <ArrowLeft className="h-4 w-4" />
            戻る
          </button>
          <h3 className="text-base font-semibold text-discord-header-primary">
            ロールの編集 - {getRoleDisplayName(role)}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!canMoveUp || isBusy}
            onClick={() => void handleMove("up")}
          >
            <ArrowUp className="mr-1.5 h-4 w-4" />
            上へ
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canMoveDown || isBusy}
            onClick={() => void handleMove("down")}
          >
            <ArrowDown className="mr-1.5 h-4 w-4" />
            下へ
          </Button>
        </div>
      </div>

      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as RoleEditTab)}
        className="mb-4"
      />

      {submitError !== null && <p className="mb-4 text-sm text-discord-brand-red">{submitError}</p>}
      {saveSuccessMessage !== null && (
        <p className="mb-4 text-sm text-discord-brand-green">{saveSuccessMessage}</p>
      )}

      {activeTab === "display" && (
        <div className="space-y-6">
          <Input
            label="ロール名"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
          />

          <div className="rounded-lg bg-discord-bg-secondary p-4">
            <p className="text-sm font-medium text-discord-text-normal">metadata 互換</p>
            <p className="mt-1 text-xs text-discord-text-muted">
              `color` / `hoist` / `mentionable` は v2 backend contract の保存対象外です。
              この画面では role 名と権限のみを編集します。
            </p>
            {role.isSystem && (
              <p className="mt-3 text-xs text-discord-text-muted">
                system role は削除できません。`member` は UI 上 `@everyone` として表示します。
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="space-y-4">
          {ROLE_PERMISSION_FIELDS.map((field) => (
            <div
              key={field.key}
              className="flex items-center justify-between rounded-lg bg-discord-bg-secondary px-4 py-3"
            >
              <div className="pr-4">
                <p className="text-sm text-discord-text-normal">{field.label}</p>
                <p className="mt-1 text-xs text-discord-text-muted">{field.description}</p>
              </div>
              <Toggle
                checked={
                  field.key === "allowView"
                    ? allowView
                    : field.key === "allowPost"
                      ? allowPost
                      : allowManage
                }
                onChange={(checked) => {
                  const setter: Record<RolePermissionField, (value: boolean) => void> = {
                    allowView: setAllowView,
                    allowPost: setAllowPost,
                    allowManage: setAllowManage,
                  };
                  setter[field.key](checked);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === "members" && (
        <div>
          <Input
            label="メンバーを検索"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
            fullWidth
          />

          <div className="mt-4 space-y-2">
            {filteredMembers.map((member) => {
              const hasRole = member.roles.includes(role.id);
              const isPending = pendingMemberId === member.user.id;

              return (
                <div
                  key={member.user.id}
                  className="flex items-center gap-3 rounded-lg bg-discord-bg-secondary px-4 py-3"
                >
                  <Checkbox
                    checked={hasRole}
                    disabled={isPending || isBusy}
                    onChange={(checked) => void handleMemberToggle(member, checked)}
                  />
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-bg-tertiary text-discord-text-normal"
                    aria-hidden="true"
                  >
                    {role.id === "member" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-discord-text-normal">
                      {getMemberDisplayName(member)}
                    </p>
                    <p className="truncate text-xs text-discord-text-muted">
                      {member.user.username}
                    </p>
                  </div>
                  {isPending && <span className="text-xs text-discord-text-muted">更新中...</span>}
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <p className="py-4 text-center text-sm text-discord-text-muted">
                対象メンバーが見つかりません。
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 rounded-lg bg-discord-bg-tertiary p-3">
        <div className="text-sm text-discord-text-normal">
          {hasChanges ? "変更が保存されていません" : "保存済みの状態です"}
        </div>
        <div className="flex items-center gap-2">
          {onDelete !== null && (
            <Button
              variant="danger"
              size="sm"
              disabled={isBusy}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              削除
            </Button>
          )}
          <Button size="sm" disabled={!hasChanges || isBusy} onClick={() => void handleSave()}>
            {isSaving ? "保存中..." : "変更を保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
