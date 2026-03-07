"use client";

import type { PermissionSnapshot } from "@/shared/api/api-client";
import { GuildChannelApiError } from "@/shared/api/guild-channel-api-client";
import { usePermissionSnapshot } from "./use-permission-snapshot";

export type ActionGuardRequirement =
  | "guild:create-channel"
  | "guild:manage-settings"
  | "guild:moderate"
  | "channel:manage";

export type ActionGuardStatus = "loading" | "allowed" | "forbidden" | "unavailable";

export type ActionGuardScreenKind = "forbidden" | "service-unavailable";

const ACTION_GUARD_MESSAGES: Record<Exclude<ActionGuardStatus, "allowed">, string> = {
  loading: "権限を確認中です。",
  forbidden: "この操作を行う権限がありません。",
  unavailable: "認可基盤が一時的に利用できません。時間をおいて再試行してください。",
};

function resolvePermission(
  snapshot: PermissionSnapshot,
  requirement: ActionGuardRequirement,
): boolean {
  switch (requirement) {
    case "guild:create-channel":
      return snapshot.guild.canCreateChannel;
    case "guild:manage-settings":
      return snapshot.guild.canManageSettings;
    case "guild:moderate":
      return snapshot.guild.canModerate;
    case "channel:manage":
      return snapshot.channel?.canManage ?? false;
  }
}

/**
 * snapshot の boolean を guard 状態へ正規化する。
 */
export function resolveActionGuardStatus(
  snapshot: PermissionSnapshot,
  requirement: ActionGuardRequirement,
): Exclude<ActionGuardStatus, "loading" | "unavailable"> {
  return resolvePermission(snapshot, requirement) ? "allowed" : "forbidden";
}

/**
 * query error を guard 状態へ正規化する。
 */
export function resolveActionGuardErrorStatus(
  error: unknown,
): Exclude<ActionGuardStatus, "allowed" | "loading"> {
  if (
    error instanceof GuildChannelApiError &&
    (error.code === "AUTHZ_UNAVAILABLE" || error.status === 503)
  ) {
    return "unavailable";
  }

  return "forbidden";
}

/**
 * guard 状態に対応する画面メッセージを返す。
 */
export function getActionGuardMessage(status: ActionGuardStatus): string | null {
  if (status === "allowed") {
    return null;
  }

  return ACTION_GUARD_MESSAGES[status];
}

/**
 * page guard 用の遷移種別を返す。
 */
export function getActionGuardScreenKind(status: ActionGuardStatus): ActionGuardScreenKind | null {
  if (status === "forbidden") {
    return "forbidden";
  }
  if (status === "unavailable") {
    return "service-unavailable";
  }

  return null;
}

/**
 * permission snapshot を ActionGuard 状態へ変換する。
 */
export function useActionGuard(input: {
  serverId: string;
  requirement: ActionGuardRequirement;
  channelId?: string | null;
  enabled?: boolean;
}) {
  const normalizedServerId = input.serverId.trim();
  const normalizedChannelId = input.channelId?.trim() ?? "";
  const requiresChannel = input.requirement === "channel:manage";
  const hasTarget =
    normalizedServerId.length > 0 && (!requiresChannel || normalizedChannelId.length > 0);
  const enabled = input.enabled ?? true;

  const query = usePermissionSnapshot(normalizedServerId, {
    channelId: normalizedChannelId.length > 0 ? normalizedChannelId : null,
    enabled: enabled && hasTarget,
  });

  let status: ActionGuardStatus;
  if (!hasTarget) {
    status = "forbidden";
  } else if (!enabled || query.isPending) {
    status = "loading";
  } else if (query.isError) {
    status = resolveActionGuardErrorStatus(query.error);
  } else if (query.data === undefined) {
    status = "loading";
  } else {
    status = resolveActionGuardStatus(query.data, input.requirement);
  }

  return {
    status,
    isAllowed: status === "allowed",
    message: getActionGuardMessage(status),
  };
}
