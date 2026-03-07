import { describe, expect, test } from "vitest";
import type { PermissionSnapshot } from "@/shared/api/api-client";
import { GuildChannelApiError } from "@/shared/api/guild-channel-api-client";
import {
  getActionGuardMessage,
  getActionGuardScreenKind,
  resolveActionGuardErrorStatus,
  resolveActionGuardStatus,
} from "./use-action-guard";

function createSnapshot(overrides?: Partial<PermissionSnapshot>): PermissionSnapshot {
  return {
    guildId: "2001",
    channelId: "3001",
    guild: {
      canView: true,
      canCreateChannel: true,
      canCreateInvite: false,
      canManageSettings: true,
      canModerate: true,
    },
    channel: {
      canView: true,
      canPost: true,
      canManage: true,
    },
    ...overrides,
  };
}

describe("useActionGuard helpers", () => {
  test("maps allowed snapshot permissions to allowed state", () => {
    expect(resolveActionGuardStatus(createSnapshot(), "guild:create-channel")).toBe("allowed");
    expect(resolveActionGuardStatus(createSnapshot(), "guild:manage-settings")).toBe("allowed");
    expect(resolveActionGuardStatus(createSnapshot(), "guild:moderate")).toBe("allowed");
    expect(resolveActionGuardStatus(createSnapshot(), "channel:manage")).toBe("allowed");
  });

  test("maps denied snapshot permissions to forbidden state", () => {
    const snapshot = createSnapshot({
      guild: {
        canView: true,
        canCreateChannel: false,
        canCreateInvite: false,
        canManageSettings: false,
        canModerate: false,
      },
      channel: {
        canView: true,
        canPost: true,
        canManage: false,
      },
    });

    expect(resolveActionGuardStatus(snapshot, "guild:create-channel")).toBe("forbidden");
    expect(resolveActionGuardStatus(snapshot, "guild:manage-settings")).toBe("forbidden");
    expect(resolveActionGuardStatus(snapshot, "guild:moderate")).toBe("forbidden");
    expect(resolveActionGuardStatus(snapshot, "channel:manage")).toBe("forbidden");
  });

  test("maps unavailable backend errors to unavailable state", () => {
    expect(
      resolveActionGuardErrorStatus(
        new GuildChannelApiError("unavailable", { code: "AUTHZ_UNAVAILABLE" }),
      ),
    ).toBe("unavailable");
    expect(
      resolveActionGuardErrorStatus(new GuildChannelApiError("unavailable", { status: 503 })),
    ).toBe("unavailable");
  });

  test("maps other backend errors to forbidden state", () => {
    expect(
      resolveActionGuardErrorStatus(new GuildChannelApiError("denied", { code: "AUTHZ_DENIED" })),
    ).toBe("forbidden");
    expect(resolveActionGuardErrorStatus(new Error("boom"))).toBe("forbidden");
  });

  test("returns message and route guard mapping for blocked states", () => {
    expect(getActionGuardMessage("allowed")).toBeNull();
    expect(getActionGuardMessage("loading")).toBe("権限を確認中です。");
    expect(getActionGuardMessage("forbidden")).toBe("この操作を行う権限がありません。");
    expect(getActionGuardMessage("unavailable")).toBe(
      "認可基盤が一時的に利用できません。時間をおいて再試行してください。",
    );

    expect(getActionGuardScreenKind("loading")).toBeNull();
    expect(getActionGuardScreenKind("allowed")).toBeNull();
    expect(getActionGuardScreenKind("forbidden")).toBe("forbidden");
    expect(getActionGuardScreenKind("unavailable")).toBe("service-unavailable");
  });
});
