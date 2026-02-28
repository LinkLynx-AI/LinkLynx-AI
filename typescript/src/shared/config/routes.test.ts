import { describe, expect, test } from "vitest";
import { APP_ROUTES, buildChannelRoute, buildInviteRoute } from "./routes";

describe("routes", () => {
  test("公開ルート契約を固定する", () => {
    expect(APP_ROUTES.home).toBe("/");
    expect(APP_ROUTES.login).toBe("/login");
    expect(APP_ROUTES.register).toBe("/register");
    expect(APP_ROUTES.verifyEmail).toBe("/verify-email");
    expect(APP_ROUTES.passwordReset).toBe("/password-reset");
    expect(APP_ROUTES.channels.me).toBe("/channels/@me");
    expect(APP_ROUTES.settings.profile).toBe("/settings/profile");
  });

  test("invite ルートを生成する", () => {
    expect(buildInviteRoute("abc123")).toBe("/invite/abc123");
    expect(buildInviteRoute("a/b c")).toBe("/invite/a%2Fb%20c");
  });

  test("channel ルートを生成する", () => {
    expect(buildChannelRoute("guild-1", "channel-2")).toBe("/channels/guild-1/channel-2");
    expect(buildChannelRoute("guild/a", "channel b")).toBe("/channels/guild%2Fa/channel%20b");
  });
});
