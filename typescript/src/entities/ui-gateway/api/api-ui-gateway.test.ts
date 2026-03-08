import { afterEach, describe, expect, test, vi } from "vitest";
import { createApiUiGateway } from "./api-ui-gateway";

const originalFetch = global.fetch;

function stubFetchResponse(response: Response) {
  const fetchMock = vi.fn(() => Promise.resolve(response));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe("createApiUiGateway", () => {
  test("invite verify の valid 応答を page content に変換する", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    stubFetchResponse(
      new Response(
        JSON.stringify({
          ok: true,
          request_id: "invite-valid-test",
          invite: {
            status: "valid",
            invite_code: "DEVJOIN2026",
            guild: {
              guild_id: 2001,
              name: "LinkLynx Developers",
              icon_key: null,
            },
            expires_at: "2026-03-21T00:00:00Z",
            uses: 2,
            max_uses: 100,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const gateway = createApiUiGateway();
    const content = await gateway.guild.getInvitePageContent("DEVJOIN2026");

    expect(content.status).toBe("valid");
    expect(content.title).toContain("LinkLynx Developers");
    expect(content.primaryAction.href).toBe("/login");
  });

  test("API base URL に path がある場合も invite verify endpoint を正しく連結する", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/v1";
    const fetchMock = stubFetchResponse(
      new Response(
        JSON.stringify({
          ok: true,
          request_id: "invite-valid-test",
          invite: {
            status: "valid",
            invite_code: "DEVJOIN2026",
            guild: {
              guild_id: 2001,
              name: "LinkLynx Developers",
              icon_key: null,
            },
            expires_at: "2026-03-21T00:00:00Z",
            uses: 2,
            max_uses: 100,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const gateway = createApiUiGateway();
    await gateway.guild.getInvitePageContent("DEVJOIN2026");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/v1/invites/DEVJOIN2026", {
      method: "GET",
      cache: "no-store",
    });
  });

  test("backend error は unavailable 相当の content にフォールバックする", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    stubFetchResponse(
      new Response(
        JSON.stringify({
          code: "INVITE_UNAVAILABLE",
          message: "invite verification dependency is unavailable",
          request_id: "invite-unavailable-test",
        }),
        {
          status: 503,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const gateway = createApiUiGateway();
    const content = await gateway.guild.getInvitePageContent("DEVJOIN2026");

    expect(content.status).toBe("unavailable");
    expect(content.title).toBe("現在、招待を確認できません");
    expect(content.description).not.toContain("invite-unavailable-test");
    expect(content.description).not.toContain("invite verification dependency is unavailable");
  });

  test("API URL 未設定時も throw せず fallback content を返す", async () => {
    const gateway = createApiUiGateway();
    const content = await gateway.guild.getInvitePageContent("DEVJOIN2026");

    expect(content.status).toBe("unavailable");
    expect(content.title).toBe("現在、招待を確認できません");
    expect(content.description).not.toContain("NEXT_PUBLIC_API_URL");
  });

  test("backend の invalid 応答は無効状態として扱う", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    stubFetchResponse(
      new Response(
        JSON.stringify({
          ok: true,
          request_id: "invite-invalid-test",
          invite: {
            status: "invalid",
            invite_code: "DEVJOIN2026",
            guild: null,
            expires_at: null,
            uses: null,
            max_uses: null,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const gateway = createApiUiGateway();
    const content = await gateway.guild.getInvitePageContent("DEVJOIN2026");

    expect(content.status).toBe("invalid");
    expect(content.title).toBe("招待リンクが無効です");
  });
});
