import { authenticatedFetch } from "@/entities";
import { z } from "zod";
import type { InviteJoinErrorCode, InviteJoinResult } from "../model";
import { createInviteJoinError } from "../model";

const API_BASE_URL_SCHEMA = z.string().url();
const INVITE_JOIN_RESPONSE_SCHEMA = z.object({
  ok: z.literal(true),
  request_id: z.string().trim().min(1),
  join: z.object({
    invite_code: z.string().trim().min(1),
    guild_id: z.number().int().positive(),
    status: z.enum(["joined", "already_member"]),
  }),
});
const BACKEND_ERROR_RESPONSE_SCHEMA = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  request_id: z.string().trim().min(1),
});

function mapBackendInviteJoinErrorCode(code: string): InviteJoinErrorCode {
  switch (code) {
    case "AUTH_MISSING_TOKEN":
    case "AUTH_INVALID_TOKEN":
    case "AUTH_TOKEN_EXPIRED":
      return "unauthenticated";
    case "AUTH_EMAIL_NOT_VERIFIED":
      return "email-not-verified";
    case "INVITE_INVALID":
      return "invalid-invite";
    case "INVITE_EXPIRED":
      return "expired-invite";
    case "RATE_LIMITED":
      return "rate-limited";
    case "INVITE_UNAVAILABLE":
    case "AUTH_UNAVAILABLE":
      return "temporarily-unavailable";
    default:
      return "unknown";
  }
}

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

function toInviteJoinUrl(apiBaseUrl: string, code: string): string {
  const parsedBaseUrl = new URL(apiBaseUrl);
  const normalizedPathname = parsedBaseUrl.pathname.replace(/\/+$/, "");
  const apiRootPath = normalizedPathname.endsWith("/v1")
    ? normalizedPathname
    : `${normalizedPathname}/v1`;
  parsedBaseUrl.pathname = `${apiRootPath}/invites/${encodeURIComponent(code.trim())}/join`.replace(
    /\/{2,}/g,
    "/",
  );
  parsedBaseUrl.search = "";
  parsedBaseUrl.hash = "";
  return parsedBaseUrl.toString();
}

/**
 * 現在の認証ユーザーで invite join API を実行する。
 */
export async function joinInvite(code: string): Promise<InviteJoinResult> {
  let endpointUrl: string;
  try {
    endpointUrl = toInviteJoinUrl(resolveApiBaseUrl(), code);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "frontend runtime configuration is invalid.";
    return {
      ok: false,
      error: createInviteJoinError({
        code: "unknown",
        message,
      }),
    };
  }

  const fetchResult = await authenticatedFetch(endpointUrl, {
    method: "POST",
  });
  if (!fetchResult.ok) {
    if (fetchResult.error.code === "unauthenticated") {
      return {
        ok: false,
        error: createInviteJoinError({
          code: "unauthenticated",
          message: fetchResult.error.message,
        }),
      };
    }

    if (fetchResult.error.code === "token-unavailable") {
      return {
        ok: false,
        error: createInviteJoinError({
          code: "token-unavailable",
          message: fetchResult.error.message,
        }),
      };
    }

    return {
      ok: false,
      error: createInviteJoinError({
        code: "network-request-failed",
        message: fetchResult.error.message,
      }),
    };
  }

  const response = fetchResult.response;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error: createInviteJoinError({
        code: "unexpected-response",
        message: "招待APIから不正なレスポンスを受信しました。",
        status: response.status,
      }),
    };
  }

  if (response.ok) {
    const parsedResponse = INVITE_JOIN_RESPONSE_SCHEMA.safeParse(payload);
    if (!parsedResponse.success) {
      return {
        ok: false,
        error: createInviteJoinError({
          code: "unexpected-response",
          message: "招待参加レスポンスの形式が不正です。",
          status: response.status,
        }),
      };
    }

    return {
      ok: true,
      data: {
        inviteCode: parsedResponse.data.join.invite_code,
        guildId: String(parsedResponse.data.join.guild_id),
        status: parsedResponse.data.join.status,
        requestId: parsedResponse.data.request_id,
      },
    };
  }

  const parsedError = BACKEND_ERROR_RESPONSE_SCHEMA.safeParse(payload);
  if (!parsedError.success) {
    return {
      ok: false,
      error: createInviteJoinError({
        code: "unexpected-response",
        message: "招待参加エラーレスポンスの形式が不正です。",
        status: response.status,
      }),
    };
  }

  return {
    ok: false,
    error: createInviteJoinError({
      code: mapBackendInviteJoinErrorCode(parsedError.data.code),
      message: parsedError.data.message,
      backendCode: parsedError.data.code,
      requestId: parsedError.data.request_id,
      status: response.status,
    }),
  };
}
