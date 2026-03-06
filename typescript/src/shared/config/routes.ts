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
    moderationQueue: "/channels/[guildId]/moderation",
    moderationReport: "/channels/[guildId]/moderation/[reportId]",
  },
  settings: {
    profile: "/settings/profile",
    appearance: "/settings/appearance",
  },
} as const;

export type SettingsRouteSection = keyof typeof APP_ROUTES.settings;

export type GuardKind = "unauthenticated" | "forbidden" | "not-found" | "service-unavailable";
export type RouteAccessKind = "public" | "auth" | "protected" | "unknown";
export type LoginRedirectReason = "unauthenticated" | "session-expired";
export type GuildChannelRouteSelection = {
  guildId: string;
  channelId: string | null;
};

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

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
 * `/channels/{guildId}` または `/channels/{guildId}/{channelId}` から選択状態を抽出する。
 */
export function parseGuildChannelRoute(pathname: string): GuildChannelRouteSelection | null {
  const normalizedPathname = normalizePathname(pathname.trim());
  if (!normalizedPathname.startsWith("/channels/")) {
    return null;
  }

  const routeSegments = normalizedPathname.slice("/channels/".length).split("/");

  if (routeSegments.length < 1 || routeSegments.length > 2) {
    return null;
  }
  if (
    routeSegments.some(
      (segment) => segment.length === 0 || safeDecodeURIComponent(segment) === null,
    )
  ) {
    return null;
  }

  const rawGuildId = routeSegments[0];
  if (rawGuildId === undefined || rawGuildId.toLowerCase() === "me") {
    return null;
  }

  const guildId = safeDecodeURIComponent(rawGuildId);
  if (guildId === null || guildId.trim().length === 0) {
    return null;
  }

  const rawChannelId = routeSegments[1];
  if (rawChannelId === undefined) {
    return {
      guildId,
      channelId: null,
    };
  }

  const channelId = safeDecodeURIComponent(rawChannelId);
  if (channelId === null || channelId.trim().length === 0) {
    return null;
  }

  return {
    guildId,
    channelId,
  };
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

export function buildGuildRoute(guildId: string): string {
  const encodedGuildId = encodeURIComponent(guildId.trim());
  return `/channels/${encodedGuildId}`;
}

export function buildChannelRoute(guildId: string, channelId: string): string {
  const encodedGuildId = encodeURIComponent(guildId.trim());
  const encodedChannelId = encodeURIComponent(channelId.trim());

  return `/channels/${encodedGuildId}/${encodedChannelId}`;
}

export function buildModerationQueueRoute(guildId: string): string {
  const encodedGuildId = encodeURIComponent(guildId.trim());
  return `/channels/${encodedGuildId}/moderation`;
}

export function buildModerationReportRoute(guildId: string, reportId: string): string {
  const encodedGuildId = encodeURIComponent(guildId.trim());
  const encodedReportId = encodeURIComponent(reportId.trim());
  return `/channels/${encodedGuildId}/moderation/${encodedReportId}`;
}

/**
 * settings 画面への遷移URLを構築する。
 */
export function buildSettingsRoute(
  section: SettingsRouteSection,
  params: {
    returnTo?: string | null;
  } = {},
): string {
  const pathname = APP_ROUTES.settings[section];
  const normalizedReturnToPath = normalizeReturnToPath(params.returnTo);

  if (normalizedReturnToPath === null) {
    return pathname;
  }

  const query = new URLSearchParams({
    returnTo: normalizedReturnToPath,
  });

  return `${pathname}?${query.toString()}`;
}
