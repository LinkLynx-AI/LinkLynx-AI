import { z } from "zod";
import { APP_ROUTES } from "@/shared/config";
import type { InvitePageContent, UiGateway } from "../model";
import { createMockUiGateway } from "./mock-ui-gateway";

const API_BASE_URL_SCHEMA = z.string().url();
const INVITE_VERIFY_RESPONSE_SCHEMA = z.object({
  ok: z.literal(true),
  request_id: z.string().trim().min(1),
  invite: z.object({
    status: z.enum(["valid", "invalid", "expired"]),
    invite_code: z.string().trim().min(1),
    guild: z
      .object({
        guild_id: z.number().int().positive(),
        name: z.string().trim().min(1),
        icon_key: z.string().trim().min(1).nullable().optional(),
      })
      .nullable(),
    expires_at: z.string().trim().min(1).nullable(),
    uses: z.number().int().nonnegative().nullable(),
    max_uses: z.number().int().positive().nullable(),
  }),
});
const BACKEND_ERROR_RESPONSE_SCHEMA = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  request_id: z.string().trim().min(1),
});

type InviteVerifyResponse = z.infer<typeof INVITE_VERIFY_RESPONSE_SCHEMA>;

function resolveApiBaseUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new Error("NEXT_PUBLIC_API_URL is required but not set.");
  }

  const parsed = API_BASE_URL_SCHEMA.safeParse(rawUrl);
  if (!parsed.success) {
    const reason = parsed.error.issues.map((issue) => issue.message).join(", ");
    throw new Error(`NEXT_PUBLIC_API_URL is invalid: ${reason}`);
  }

  return parsed.data.replace(/\/+$/, "");
}

function toInviteVerifyUrl(apiBaseUrl: string, code: string): string {
  const parsedBaseUrl = new URL(apiBaseUrl);
  const normalizedPathname = parsedBaseUrl.pathname.replace(/\/+$/, "");
  const apiRootPath = normalizedPathname.endsWith("/v1")
    ? normalizedPathname
    : `${normalizedPathname}/v1`;
  parsedBaseUrl.pathname = `${apiRootPath}/invites/${encodeURIComponent(code.trim())}`.replace(
    /\/{2,}/g,
    "/",
  );
  parsedBaseUrl.search = "";
  parsedBaseUrl.hash = "";
  return parsedBaseUrl.toString();
}

function buildLoginAction() {
  return {
    label: "ログイン",
    href: APP_ROUTES.login,
  };
}

function buildHomeAction() {
  return {
    label: "ホームへ戻る",
    href: APP_ROUTES.home,
  };
}

function buildRetryInviteAction(code: string) {
  return {
    label: "もう一度試す",
    href: `/invite/${encodeURIComponent(code.trim())}`,
  };
}

function buildUnavailableInviteContent(code: string): InvitePageContent {
  return {
    status: "unavailable",
    title: "現在、招待を確認できません",
    description:
      "時間をおいて再試行してください。改善しない場合は招待を送信した相手に確認してください。",
    inviteCode: code.trim(),
    guildName: null,
    expiresAt: null,
    uses: null,
    maxUses: null,
    primaryAction: buildRetryInviteAction(code),
    secondaryAction: buildHomeAction(),
  };
}

function mapInviteResponseToPageContent(payload: InviteVerifyResponse): InvitePageContent {
  const { invite } = payload;
  const guildName = invite.guild?.name ?? null;

  if (invite.status === "expired") {
    return {
      status: "expired",
      title: "招待リンクの期限が切れています",
      description: "新しい招待リンクを送ってもらってください。",
      inviteCode: invite.invite_code,
      guildName,
      expiresAt: invite.expires_at,
      uses: invite.uses,
      maxUses: invite.max_uses,
      primaryAction: buildHomeAction(),
      secondaryAction: buildLoginAction(),
    };
  }

  if (invite.status === "invalid") {
    return {
      status: "invalid",
      title: "招待リンクが無効です",
      description: "リンクが見つからないか、すでに利用できません。",
      inviteCode: invite.invite_code,
      guildName,
      expiresAt: invite.expires_at,
      uses: invite.uses,
      maxUses: invite.max_uses,
      primaryAction: buildHomeAction(),
      secondaryAction: buildLoginAction(),
    };
  }

  return {
    status: "valid",
    title: guildName === null ? "招待リンクを確認しました" : `${guildName} への招待です`,
    description: "ログインすると参加前の確認画面として利用できます。",
    inviteCode: invite.invite_code,
    guildName,
    expiresAt: invite.expires_at,
    uses: invite.uses,
    maxUses: invite.max_uses,
    primaryAction: buildLoginAction(),
    secondaryAction: buildHomeAction(),
  };
}

/**
 * 招待コード検証結果を API から取得して UI 表示用に変換する。
 */
async function getInvitePageContentFromApi(code: string): Promise<InvitePageContent> {
  let endpointUrl: string;
  try {
    endpointUrl = toInviteVerifyUrl(resolveApiBaseUrl(), code);
  } catch {
    return buildUnavailableInviteContent(code);
  }

  let response: Response;
  try {
    response = await fetch(endpointUrl, {
      method: "GET",
      cache: "no-store",
    });
  } catch {
    return buildUnavailableInviteContent(code);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return buildUnavailableInviteContent(code);
  }

  if (!response.ok) {
    const parsedError = BACKEND_ERROR_RESPONSE_SCHEMA.safeParse(payload);
    if (!parsedError.success) {
      return buildUnavailableInviteContent(code);
    }

    return buildUnavailableInviteContent(code);
  }

  const parsedResponse = INVITE_VERIFY_RESPONSE_SCHEMA.safeParse(payload);
  if (!parsedResponse.success) {
    return buildUnavailableInviteContent(code);
  }

  return mapInviteResponseToPageContent(parsedResponse.data);
}

/**
 * 招待 verify API を組み込んだ UI Gateway を生成する。
 */
export function createApiUiGateway(): UiGateway {
  const fallbackGateway = createMockUiGateway();

  return {
    ...fallbackGateway,
    guild: {
      ...fallbackGateway.guild,
      getInvitePageContent(code: string) {
        return getInvitePageContentFromApi(code);
      },
    },
  };
}
