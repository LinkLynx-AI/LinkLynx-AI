import { z } from "zod";
import { authenticatedFetch } from "./authenticated-fetch";

const API_BASE_URL_SCHEMA = z.string().url();
const WS_TICKET_RESPONSE_SCHEMA = z.object({
  ticket: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1),
});
const API_ERROR_RESPONSE_SCHEMA = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  request_id: z.string().trim().min(1),
});

export type WsTicketIssueErrorCode =
  | "unauthenticated"
  | "token-unavailable"
  | "forbidden"
  | "temporarily-unavailable"
  | "unexpected-response"
  | "unknown";

export type WsTicketIssueError = {
  code: WsTicketIssueErrorCode;
  message: string;
  backendCode: string | null;
  requestId: string | null;
  status: number | null;
};

export type WsTicketIssueResult =
  | {
      ok: true;
      data: {
        ticket: string;
        expiresAt: string;
      };
    }
  | {
      ok: false;
      error: WsTicketIssueError;
    };

function createWsTicketIssueError(params: {
  code: WsTicketIssueErrorCode;
  message: string;
  backendCode?: string | null;
  requestId?: string | null;
  status?: number | null;
}): WsTicketIssueError {
  return {
    code: params.code,
    message: params.message,
    backendCode: params.backendCode ?? null,
    requestId: params.requestId ?? null,
    status: params.status ?? null,
  };
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

function toWsTicketUrl(apiBaseUrl: string): string {
  const parsedBaseUrl = new URL(apiBaseUrl);
  const normalizedPathname = parsedBaseUrl.pathname.replace(/\/+$/, "");
  parsedBaseUrl.pathname = `${normalizedPathname}/auth/ws-ticket`.replace(/\/{2,}/g, "/");
  parsedBaseUrl.search = "";
  parsedBaseUrl.hash = "";
  return parsedBaseUrl.toString();
}

function mapBackendErrorCode(code: string): WsTicketIssueErrorCode {
  switch (code) {
    case "AUTH_MISSING_TOKEN":
    case "AUTH_INVALID_TOKEN":
    case "AUTH_TOKEN_EXPIRED":
      return "unauthenticated";
    case "AUTH_EMAIL_NOT_VERIFIED":
    case "AUTH_PRINCIPAL_NOT_MAPPED":
      return "forbidden";
    case "AUTH_UNAVAILABLE":
      return "temporarily-unavailable";
    default:
      return "unknown";
  }
}

/**
 * WS identify 用ワンタイムチケットを発行する。
 */
export async function issueWsTicket(params?: {
  forceRefresh?: boolean;
}): Promise<WsTicketIssueResult> {
  let endpointUrl: string;
  try {
    endpointUrl = toWsTicketUrl(resolveApiBaseUrl());
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "frontend runtime configuration is invalid.";
    return {
      ok: false,
      error: createWsTicketIssueError({
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
      method: "POST",
    },
    fetchOptions,
  );

  if (!fetchResult.ok) {
    if (fetchResult.error.code === "network-request-failed") {
      return {
        ok: false,
        error: createWsTicketIssueError({
          code: "temporarily-unavailable",
          message: fetchResult.error.message,
        }),
      };
    }

    return {
      ok: false,
      error: createWsTicketIssueError({
        code: fetchResult.error.code,
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
      error: createWsTicketIssueError({
        code: "unexpected-response",
        message: "認証APIから不正なレスポンスを受信しました。",
        status: response.status,
      }),
    };
  }

  if (response.ok) {
    const parsedSuccess = WS_TICKET_RESPONSE_SCHEMA.safeParse(payload);
    if (!parsedSuccess.success) {
      return {
        ok: false,
        error: createWsTicketIssueError({
          code: "unexpected-response",
          message: "WSチケットAPIレスポンスの形式が不正です。",
          status: response.status,
        }),
      };
    }

    return {
      ok: true,
      data: {
        ticket: parsedSuccess.data.ticket,
        expiresAt: parsedSuccess.data.expiresAt,
      },
    };
  }

  const parsedError = API_ERROR_RESPONSE_SCHEMA.safeParse(payload);
  if (!parsedError.success) {
    return {
      ok: false,
      error: createWsTicketIssueError({
        code: "unexpected-response",
        message: "WSチケットAPIエラーレスポンスの形式が不正です。",
        status: response.status,
      }),
    };
  }

  return {
    ok: false,
    error: createWsTicketIssueError({
      code: mapBackendErrorCode(parsedError.data.code),
      message: parsedError.data.message,
      backendCode: parsedError.data.code,
      requestId: parsedError.data.request_id,
      status: response.status,
    }),
  };
}
