export const APP_ROUTES = {
  home: "/",
  invite: "/invite/[code]",
  login: "/login",
  register: "/register",
  verifyEmail: "/verify-email",
  passwordReset: "/password-reset",
  channels: {
    me: "/channels/@me",
    guildChannel: "/channels/[guildId]/[channelId]",
  },
  settings: {
    profile: "/settings/profile",
    appearance: "/settings/appearance",
  },
} as const;

export type GuardKind = "unauthenticated" | "forbidden" | "not-found";

export type PlaceholderState = "loading" | "empty" | "error" | "readonly" | "disabled";

export function buildInviteRoute(code: string): string {
  return `/invite/${encodeURIComponent(code.trim())}`;
}

export function buildChannelRoute(guildId: string, channelId: string): string {
  const encodedGuildId = encodeURIComponent(guildId.trim());
  const encodedChannelId = encodeURIComponent(channelId.trim());

  return `/channels/${encodedGuildId}/${encodedChannelId}`;
}
