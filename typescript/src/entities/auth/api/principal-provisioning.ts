import { z } from "zod";
import type { PrincipalProvisionErrorCode, PrincipalProvisionResult } from "../model";
import { createPrincipalProvisionError } from "../model";
import { authenticatedFetch } from "./authenticated-fetch";

const API_BASE_URL_SCHEMA = z.string().url();
const PROTECTED_PING_SUCCESS_SCHEMA = z.object({
  ok: z.literal(true),
  request_id: z.string().trim().min(1),
  principal_id: z.number().int().positive(),
  firebase_uid: z.string().trim().min(1),
});
const AUTH_ERROR_RESPONSE_SCHEMA = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  request_id: z.string().trim().min(1),
});

function mapBackendAuthErrorCode(code: string): PrincipalProvisionErrorCode {
  switch (code) {
    case "AUTH_MISSING_TOKEN":
    case "AUTH_INVALID_TOKEN":
    case "AUTH_TOKEN_EXPIRED":
      return "unauthenticated";
    case "AUTH_EMAIL_NOT_VERIFIED":
      return "email-not-verified";
    case "AUTH_PRINCIPAL_NOT_MAPPED":
      return "principal-not-mapped";
    case "AUTH_UNAVAILABLE":
      return "auth-unavailable";
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

  return parsed.data;
}

function toProtectedPingUrl(apiBaseUrl: string): string {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  return `${normalizedBaseUrl}/v1/protected/ping`;
}

function appendRequestIdSuffix(message: string, requestId: string | null): string {
  if (requestId === null) {
    return message;
  }

  return `${message} (request_id: ${requestId})`;
}

/**
 * 現在の認証ユーザーで principal 自動作成導線を強制実行する。
 */
export async function ensurePrincipalProvisionedForCurrentUser(params?: {
  forceRefresh?: boolean;
}): Promise<PrincipalProvisionResult> {
  let endpointUrl: string;
  try {
    endpointUrl = toProtectedPingUrl(resolveApiBaseUrl());
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "frontend runtime configuration is invalid.";
    return {
      ok: false,
      error: createPrincipalProvisionError({
        code: "unknown",
        message,
      }),
    };
  }

  const fetchOptions =
    params?.forceRefresh === undefined ? {} : { forceRefresh: params.forceRefresh };
  const fetchResult = await authenticatedFetch(
    endpointUrl,
    {
      method: "GET",
    },
    fetchOptions,
  );
  if (!fetchResult.ok) {
    if (fetchResult.error.code === "unauthenticated") {
      return {
        ok: false,
        error: createPrincipalProvisionError({
          code: "unauthenticated",
          message: fetchResult.error.message,
        }),
      };
    }

    if (fetchResult.error.code === "token-unavailable") {
      return {
        ok: false,
        error: createPrincipalProvisionError({
          code: "network-request-failed",
          message: fetchResult.error.message,
        }),
      };
    }

    return {
      ok: false,
      error: createPrincipalProvisionError({
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
      error: createPrincipalProvisionError({
        code: "unexpected-response",
        message: "認証APIから不正なレスポンスを受信しました。",
        status: response.status,
      }),
    };
  }

  if (response.ok) {
    const parsedSuccess = PROTECTED_PING_SUCCESS_SCHEMA.safeParse(payload);
    if (!parsedSuccess.success) {
      return {
        ok: false,
        error: createPrincipalProvisionError({
          code: "unexpected-response",
          message: "認証APIレスポンスの形式が不正です。",
          status: response.status,
        }),
      };
    }

    return {
      ok: true,
      data: {
        principalId: parsedSuccess.data.principal_id,
        firebaseUid: parsedSuccess.data.firebase_uid,
        requestId: parsedSuccess.data.request_id,
      },
    };
  }

  const parsedError = AUTH_ERROR_RESPONSE_SCHEMA.safeParse(payload);
  if (!parsedError.success) {
    return {
      ok: false,
      error: createPrincipalProvisionError({
        code: "unexpected-response",
        message: "認証APIエラーレスポンスの形式が不正です。",
        status: response.status,
      }),
    };
  }

  return {
    ok: false,
    error: createPrincipalProvisionError({
      code: mapBackendAuthErrorCode(parsedError.data.code),
      message: appendRequestIdSuffix(parsedError.data.message, parsedError.data.request_id),
      backendCode: parsedError.data.code,
      requestId: parsedError.data.request_id,
      status: response.status,
    }),
  };
}
