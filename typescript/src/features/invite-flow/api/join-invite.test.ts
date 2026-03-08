import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AuthenticatedFetchResult } from "@/entities";

const { authenticatedFetchMock } = vi.hoisted(() => ({
  authenticatedFetchMock: vi.fn<() => Promise<AuthenticatedFetchResult>>(),
}));

vi.mock("@/entities", () => ({
  authenticatedFetch: authenticatedFetchMock,
}));

import { joinInvite } from "./join-invite";

describe("joinInvite", () => {
  beforeEach(() => {
    authenticatedFetchMock.mockReset();
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  test("success response を guild redirect 用の shape に変換する", async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      response: new Response(
        JSON.stringify({
          ok: true,
          request_id: "invite-join-test",
          join: {
            invite_code: "DEVJOIN2026",
            guild_id: 2001,
            status: "joined",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    });

    const result = await joinInvite("DEVJOIN2026");

    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/invites/DEVJOIN2026/join",
      {
        method: "POST",
      },
    );
    expect(result).toEqual({
      ok: true,
      data: {
        inviteCode: "DEVJOIN2026",
        guildId: "2001",
        status: "joined",
        requestId: "invite-join-test",
      },
    });
  });

  test("invite invalid を domain error に変換する", async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      response: new Response(
        JSON.stringify({
          code: "INVITE_INVALID",
          message: "invite is no longer valid",
          request_id: "invite-invalid-test",
        }),
        {
          status: 409,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    });

    const result = await joinInvite("DEVJOIN2026");

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid-invite",
        message: "invite is no longer valid",
        backendCode: "INVITE_INVALID",
        requestId: "invite-invalid-test",
        status: 409,
      },
    });
  });

  test("token unavailable は retry 可能な auth error に変換する", async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: false,
      error: {
        code: "token-unavailable",
        message: "IDトークンの取得に失敗しました。",
      },
    });

    const result = await joinInvite("DEVJOIN2026");

    expect(result).toEqual({
      ok: false,
      error: {
        code: "token-unavailable",
        message: "IDトークンの取得に失敗しました。",
      },
    });
  });

  test("NEXT_PUBLIC_API_URL 未設定時は unknown を返す", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    const result = await joinInvite("DEVJOIN2026");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("unknown");
    expect(result.error.message).toContain("NEXT_PUBLIC_API_URL is required");
  });
});
