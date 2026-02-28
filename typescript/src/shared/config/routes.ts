export const APP_ROUTES = {
  home: "/",
  invite: "/invite/[code]",
  login: "/login",
  register: "/register",
  verifyEmail: "/verify-email",
  passwordReset: "/password-reset",
  channels: {
    me: "/channels/me",
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

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

/**
 * ログイン画面への導線URLを生成する。
 */
export function buildLoginRoute(redirectPath?: string): string {
  if (redirectPath === undefined) {
    return APP_ROUTES.login;
  }

  const normalizedPath = redirectPath.trim();
  if (normalizedPath.length === 0 || !isSafeInternalPath(normalizedPath)) {
    return APP_ROUTES.login;
  }

  const params = new URLSearchParams({ redirect: normalizedPath });
  return `${APP_ROUTES.login}?${params.toString()}`;
}
