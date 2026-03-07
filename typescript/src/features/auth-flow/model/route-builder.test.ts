import { describe, expect, test } from "vitest";
import { buildVerifyEmailRoute } from "./index";

describe("buildVerifyEmailRoute", () => {
  test("email/sent/returnTo を含む verify-email URL を生成する", () => {
    const url = buildVerifyEmailRoute({
      email: "test@example.com",
      sent: true,
      returnTo: "/channels/me?tab=all",
    });

    expect(url).toBe(
      "/verify-email?email=test%40example.com&sent=1&returnTo=%2Fchannels%2Fme%3Ftab%3Dall",
    );
  });

  test("保護ルート以外の returnTo は除外する", () => {
    const url = buildVerifyEmailRoute({
      email: "test@example.com",
      returnTo: "/invite/abc",
    });

    expect(url).toBe("/verify-email?email=test%40example.com");
  });

  test("invite resume code を引き継ぐ", () => {
    const url = buildVerifyEmailRoute({
      email: "test@example.com",
      inviteCode: "DEVJOIN2026",
    });

    expect(url).toBe("/verify-email?email=test%40example.com&invite=DEVJOIN2026");
  });
});
