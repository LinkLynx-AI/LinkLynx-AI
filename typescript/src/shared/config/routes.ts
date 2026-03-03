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

export type GuardKind = "unauthenticated" | "forbidden" | "not-found" | "service-unavailable";
export type RouteAccessKind = "public" | "auth" | "protected" | "unknown";
export type LoginRedirectReason = "unauthenticated" | "session-expired";

export type PlaceholderState = "loading" | "empty" | "error" | "readonly" | "disabled";

const AUTH_ROUTES = new Set<string>([
  APP_ROUTES.login,
  APP_ROUTES.register,
  APP_ROUTES.verifyEmail,
  APP_ROUTES.passwordReset,
]);

function normalizePathname(pathname: string): string {
  if (pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "");
}

/**
 * 画面パスを public/auth/protected の分類へ変換する。
 */
export function classifyAppRoute(pathname: string): RouteAccessKind {
  const normalizedPathname = normalizePathname(pathname.trim());

  if (normalizedPathname === APP_ROUTES.home || normalizedPathname === "/invite") {
    return "public";
  }

  if (normalizedPathname.startsWith("/invite/")) {
    return "public";
  }

  if (AUTH_ROUTES.has(normalizedPathname)) {
    return "auth";
  }

  if (
    normalizedPathname === "/channels" ||
    normalizedPathname.startsWith("/channels/") ||
    normalizedPathname === "/settings" ||
    normalizedPathname.startsWith("/settings/")
  ) {
    return "protected";
  }

  return "unknown";
}

/**
 * returnTo クエリを内部保護ルートのみに正規化する。
 */
export function normalizeReturnToPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith("/") || trimmedValue.startsWith("//")) {
    return null;
  }

  try {
    const normalizedUrl = new URL(trimmedValue, "https://linklinx.local");
    if (normalizedUrl.origin !== "https://linklinx.local") {
      return null;
    }

    if (classifyAppRoute(normalizedUrl.pathname) !== "protected") {
      return null;
    }

    return `${normalizePathname(normalizedUrl.pathname)}${normalizedUrl.search}${normalizedUrl.hash}`;
  } catch {
    return null;
  }
}

/**
 * login 遷移URLを構築する。
 */
export function buildLoginRoute(
  params: {
    returnTo?: string | null;
    reason?: LoginRedirectReason | null;
  } = {},
): string {
  const query = new URLSearchParams();
  const normalizedReturnToPath = normalizeReturnToPath(params.returnTo);

  if (normalizedReturnToPath !== null) {
    query.set("returnTo", normalizedReturnToPath);
  }

  if (params.reason !== undefined && params.reason !== null) {
    query.set("reason", params.reason);
  }

  const queryString = query.toString();
  if (queryString === "") {
    return APP_ROUTES.login;
  }

  return `${APP_ROUTES.login}?${queryString}`;
}

/**
 * login reason クエリを判定する。
 */
export function parseLoginRedirectReason(
  value: string | string[] | undefined,
): LoginRedirectReason | null {
  const rawValue = Array.isArray(value) ? (value[0] ?? null) : value;
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  if (rawValue === "unauthenticated" || rawValue === "session-expired") {
    return rawValue;
  }

  return null;
}

export function buildInviteRoute(code: string): string {
  return `/invite/${encodeURIComponent(code.trim())}`;
}

export function buildChannelRoute(guildId: string, channelId: string): string {
  const encodedGuildId = encodeURIComponent(guildId.trim());
  const encodedChannelId = encodeURIComponent(channelId.trim());

  return `/channels/${encodedGuildId}/${encodedChannelId}`;
}
