import { describe, expect, test } from "vitest";
import {
  APP_ROUTES,
  buildChannelRoute,
  buildGuildRoute,
  buildInviteRoute,
  buildLoginRoute,
  buildModerationQueueRoute,
  buildModerationReportRoute,
  classifyAppRoute,
  normalizeReturnToPath,
  parseGuildChannelRoute,
  parseLoginRedirectReason,
} from "./routes";

describe("routes", () => {
  test("公開ルート契約を固定する", () => {
    expect(APP_ROUTES.home).toBe("/");
    expect(APP_ROUTES.login).toBe("/login");
    expect(APP_ROUTES.register).toBe("/register");
    expect(APP_ROUTES.verifyEmail).toBe("/verify-email");
    expect(APP_ROUTES.passwordReset).toBe("/password-reset");
    expect(APP_ROUTES.channels.me).toBe("/channels/me");
    expect(APP_ROUTES.channels.moderationQueue).toBe("/channels/[guildId]/moderation");
    expect(APP_ROUTES.channels.moderationReport).toBe("/channels/[guildId]/moderation/[reportId]");
    expect(APP_ROUTES.settings.profile).toBe("/settings/profile");
  });

  test("invite ルートを生成する", () => {
    expect(buildInviteRoute("abc123")).toBe("/invite/abc123");
    expect(buildInviteRoute("a/b c")).toBe("/invite/a%2Fb%20c");
  });

  test("channel ルートを生成する", () => {
    expect(buildGuildRoute("guild-1")).toBe("/channels/guild-1");
    expect(buildGuildRoute("guild/a")).toBe("/channels/guild%2Fa");
    expect(buildChannelRoute("guild-1", "channel-2")).toBe("/channels/guild-1/channel-2");
    expect(buildChannelRoute("guild/a", "channel b")).toBe("/channels/guild%2Fa/channel%20b");
    expect(buildModerationQueueRoute("guild-1")).toBe("/channels/guild-1/moderation");
    expect(buildModerationReportRoute("guild-1", "report-2")).toBe(
      "/channels/guild-1/moderation/report-2",
    );
  });

  test("guild/channel ルートから選択状態を抽出する", () => {
    expect(parseGuildChannelRoute("/channels/1001")).toEqual({
      guildId: "1001",
      channelId: null,
    });
    expect(parseGuildChannelRoute("/channels/1001/3001")).toEqual({
      guildId: "1001",
      channelId: "3001",
    });
    expect(parseGuildChannelRoute("/channels/guild%2Fa/channel%20b")).toEqual({
      guildId: "guild/a",
      channelId: "channel b",
    });
    expect(parseGuildChannelRoute("/channels/me")).toBeNull();
    expect(parseGuildChannelRoute("/channels/me/3001")).toBeNull();
    expect(parseGuildChannelRoute("/channels/1001/3001/extra")).toBeNull();
    expect(parseGuildChannelRoute("/channels//3001")).toBeNull();
    expect(parseGuildChannelRoute("/channels/%E0%A4%A/3001")).toBeNull();
    expect(parseGuildChannelRoute("/settings/profile")).toBeNull();
  });

  test("public/auth/protected のルート分類を判定する", () => {
    expect(classifyAppRoute("/")).toBe("public");
    expect(classifyAppRoute("/invite/abc123")).toBe("public");
    expect(classifyAppRoute("/login")).toBe("auth");
    expect(classifyAppRoute("/register/")).toBe("auth");
    expect(classifyAppRoute("/channels/me")).toBe("protected");
    expect(classifyAppRoute("/settings/profile")).toBe("protected");
    expect(classifyAppRoute("/unknown")).toBe("unknown");
  });

  test("returnTo は保護ルートのみ許可する", () => {
    expect(normalizeReturnToPath("/channels/me")).toBe("/channels/me");
    expect(normalizeReturnToPath("/channels/me?tab=all")).toBe("/channels/me?tab=all");
    expect(normalizeReturnToPath("/invite/abc")).toBeNull();
    expect(normalizeReturnToPath("https://example.com/channels/me")).toBeNull();
    expect(normalizeReturnToPath("//example.com/channels/me")).toBeNull();
    expect(normalizeReturnToPath(null)).toBeNull();
  });

  test("login ルートを returnTo / reason 付きで生成する", () => {
    expect(
      buildLoginRoute({
        returnTo: "/channels/me?tab=all",
        reason: "session-expired",
      }),
    ).toBe("/login?returnTo=%2Fchannels%2Fme%3Ftab%3Dall&reason=session-expired");
    expect(buildLoginRoute({ returnTo: "/invite/abc" })).toBe("/login");
    expect(buildLoginRoute()).toBe("/login");
  });

  test("login reason クエリを判定する", () => {
    expect(parseLoginRedirectReason("unauthenticated")).toBe("unauthenticated");
    expect(parseLoginRedirectReason(["session-expired"])).toBe("session-expired");
    expect(parseLoginRedirectReason("unknown")).toBeNull();
    expect(parseLoginRedirectReason(undefined)).toBeNull();
  });
});
