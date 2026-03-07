// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";

vi.mock("./server/server-overview", () => ({
  ServerOverview: () => <div>ServerOverview</div>,
}));
vi.mock("./server/server-roles", () => ({
  ServerRoles: () => <div>ServerRoles</div>,
}));
vi.mock("./server/server-members", () => ({
  ServerMembers: () => <div>ServerMembers</div>,
}));
vi.mock("./server/server-emoji", () => ({
  ServerEmoji: () => <div>ServerEmoji</div>,
}));
vi.mock("./server/server-stickers", () => ({
  ServerStickers: () => <div>ServerStickers</div>,
}));
vi.mock("./server/server-boost", () => ({
  ServerBoost: () => <div>ServerBoost</div>,
}));
vi.mock("./server/server-automod", () => ({
  ServerAutomod: () => <div>ServerAutomod</div>,
}));
vi.mock("./server/server-audit-log", () => ({
  ServerAuditLog: () => <div>ServerAuditLog</div>,
}));
vi.mock("./server/server-invites", () => ({
  ServerInvites: () => <div>ServerInvites</div>,
}));
vi.mock("./server/server-bans", () => ({
  ServerBans: () => <div>ServerBans</div>,
}));
vi.mock("./server/server-analytics", () => ({
  ServerAnalytics: () => <div>ServerAnalytics</div>,
}));
vi.mock("./user/user-account", () => ({
  UserAccount: () => <div>マイアカウント画面</div>,
}));
vi.mock("./user/user-profile", () => ({
  UserProfile: () => <div>プロフィール画面</div>,
}));
vi.mock("./user/user-nitro", () => ({
  UserNitro: () => <div>UserNitro</div>,
}));
vi.mock("./user/user-billing", () => ({
  UserBilling: () => <div>UserBilling</div>,
}));
vi.mock("./user/user-appearance", () => ({
  UserAppearance: () => <div>UserAppearance</div>,
}));
vi.mock("./user/user-voice-video", () => ({
  UserVoiceVideo: () => <div>UserVoiceVideo</div>,
}));
vi.mock("./user/user-notifications", () => ({
  UserNotifications: () => <div>UserNotifications</div>,
}));
vi.mock("./user/user-keybinds", () => ({
  UserKeybinds: () => <div>UserKeybinds</div>,
}));
vi.mock("./user/user-accessibility", () => ({
  UserAccessibility: () => <div>UserAccessibility</div>,
}));

const useActionGuardMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries", () => ({
  useActionGuard: useActionGuardMock,
  getActionGuardScreenKind: (status: string) => {
    if (status === "forbidden") {
      return "forbidden";
    }
    if (status === "unavailable") {
      return "service-unavailable";
    }
    return null;
  },
}));

import { SettingsLayout } from "./settings-layout";

describe("SettingsLayout", () => {
  beforeEach(() => {
    useActionGuardMock.mockImplementation(() => ({
      status: "allowed",
      isAllowed: true,
      message: null,
    }));
  });

  test("reaches profile screen from user settings navigation", async () => {
    render(<SettingsLayout type="user" onClose={vi.fn()} />);

    expect(screen.getByText("マイアカウント画面")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "プロフィール" }));

    expect(screen.getByText("プロフィール画面")).not.toBeNull();
  });

  test("renders route guard screen when server settings permission is denied", () => {
    useActionGuardMock.mockImplementation(() => ({
      status: "forbidden",
      isAllowed: false,
      message: "この操作を行う権限がありません。",
    }));

    render(<SettingsLayout type="server" serverId="2001" onClose={vi.fn()} />);

    expect(screen.getByText("アクセス権限がありません")).not.toBeNull();
    expect(screen.queryByText("ServerOverview")).toBeNull();
  });
});
