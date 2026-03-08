import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { createUiGatewayMock } = vi.hoisted(() => ({
  createUiGatewayMock: vi.fn(),
}));

vi.mock("@/entities", () => ({
  createUiGateway: createUiGatewayMock,
}));

import InvitePage from "./page";

describe("invite/[code]/page", () => {
  beforeEach(() => {
    createUiGatewayMock.mockReset();
  });

  test("公開招待ページでは API provider を強制する", async () => {
    const getInvitePageContent = vi.fn().mockResolvedValue({
      status: "invalid",
      title: "招待リンクが無効です",
      description: "リンクが見つからないか、すでに利用できません。",
      inviteCode: "UNKNOWN2026",
      guildName: null,
      expiresAt: null,
      uses: null,
      maxUses: null,
      primaryAction: { label: "ホームへ戻る", href: "/" },
      secondaryAction: { label: "ログイン", href: "/login" },
    });

    createUiGatewayMock.mockReturnValue({
      guild: {
        getInvitePageContent,
      },
    });

    const element = await InvitePage({
      params: { code: "UNKNOWN2026" },
    });
    const html = renderToStaticMarkup(element);

    expect(createUiGatewayMock).toHaveBeenCalledWith({ provider: "api" });
    expect(getInvitePageContent).toHaveBeenCalledWith("UNKNOWN2026");
    expect(html).toContain("招待リンクが無効です");
  });
});
