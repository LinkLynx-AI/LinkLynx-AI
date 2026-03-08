// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AuthSessionContextValue, InvitePageContent } from "@/entities";

const { routerReplaceMock, useRouterMock } = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  useRouterMock: vi.fn(() => ({
    replace: routerReplaceMock,
  })),
}));
const { joinInviteMock, buildVerifyEmailRouteMock } = vi.hoisted(() => ({
  joinInviteMock: vi.fn(),
  buildVerifyEmailRouteMock: vi.fn(() => "/verify-email?invite=DEVJOIN2026"),
}));
const { useAuthSessionMock } = vi.hoisted(() => ({
  useAuthSessionMock: vi.fn<() => AuthSessionContextValue>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));
vi.mock("@/entities", async () => {
  const actual = await vi.importActual<typeof import("@/entities")>("@/entities");
  return {
    ...actual,
    useAuthSession: useAuthSessionMock,
  };
});
vi.mock("@/features", async () => {
  const actual = await vi.importActual<typeof import("@/features")>("@/features");
  return {
    ...actual,
    buildVerifyEmailRoute: buildVerifyEmailRouteMock,
    joinInvite: joinInviteMock,
  };
});

import { InvitePageClient } from "./invite-page-client";

const inviteContent: InvitePageContent = {
  status: "valid",
  title: "LinkLynx Developers への招待です",
  description: "ログインすると参加前の確認画面として利用できます。",
  inviteCode: "DEVJOIN2026",
  guildName: "LinkLynx Developers",
  expiresAt: "2026-03-21T00:00:00Z",
  uses: 2,
  maxUses: 100,
  primaryAction: {
    label: "ログイン",
    href: "/login",
  },
  secondaryAction: {
    label: "ホームへ戻る",
    href: "/",
  },
};

function setSession(session: Partial<AuthSessionContextValue>) {
  useAuthSessionMock.mockReturnValue({
    status: "unauthenticated",
    user: null,
    getIdToken: vi.fn(),
    ...session,
  });
}

describe("InvitePageClient", () => {
  beforeEach(() => {
    routerReplaceMock.mockReset();
    useRouterMock.mockClear();
    joinInviteMock.mockReset();
    buildVerifyEmailRouteMock.mockClear();
  });

  test("未認証時は invite resume 付き login CTA を表示する", () => {
    setSession({
      status: "unauthenticated",
      user: null,
    });

    render(<InvitePageClient content={inviteContent} autoJoin={false} />);

    expect(screen.getByRole("link", { name: "ログインして参加" }).getAttribute("href")).toBe(
      "/login?invite=DEVJOIN2026",
    );
  });

  test("認証済みなら join 成功後に対象サーバーへ遷移する", async () => {
    setSession({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "member@example.com",
        emailVerified: true,
      },
    });
    joinInviteMock.mockResolvedValue({
      ok: true,
      data: {
        inviteCode: "DEVJOIN2026",
        guildId: "2001",
        status: "joined",
        requestId: "invite-join-test",
      },
    });

    render(<InvitePageClient content={inviteContent} autoJoin={false} />);

    fireEvent.click(screen.getByRole("button", { name: "サーバーに参加" }));

    await waitFor(() => {
      expect(joinInviteMock).toHaveBeenCalledWith("DEVJOIN2026");
    });
    expect(routerReplaceMock).toHaveBeenCalledWith("/channels/2001");
  });

  test("autoJoin 指定時は認証済みセッションで即 join を実行する", async () => {
    setSession({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "member@example.com",
        emailVerified: true,
      },
    });
    joinInviteMock.mockResolvedValue({
      ok: true,
      data: {
        inviteCode: "DEVJOIN2026",
        guildId: "2001",
        status: "already_member",
        requestId: "invite-join-test",
      },
    });

    render(<InvitePageClient content={inviteContent} autoJoin />);

    await waitFor(() => {
      expect(joinInviteMock).toHaveBeenCalledWith("DEVJOIN2026");
    });
    expect(routerReplaceMock).toHaveBeenCalledWith("/channels/2001");
  });

  test("未確認メールの認証済みユーザーには verify-email CTA を表示する", () => {
    setSession({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "member@example.com",
        emailVerified: false,
      },
    });

    render(<InvitePageClient content={inviteContent} autoJoin={false} />);

    expect(buildVerifyEmailRouteMock).toHaveBeenCalledWith({
      email: "member@example.com",
      inviteCode: "DEVJOIN2026",
    });
    expect(screen.getByRole("link", { name: "メール確認して参加" }).getAttribute("href")).toBe(
      "/verify-email?invite=DEVJOIN2026",
    );
  });
});
