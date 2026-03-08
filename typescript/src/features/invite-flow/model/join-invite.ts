export type InviteJoinStatus = "joined" | "already_member";

export type InviteJoinErrorCode =
  | "unauthenticated"
  | "email-not-verified"
  | "invalid-invite"
  | "expired-invite"
  | "temporarily-unavailable"
  | "rate-limited"
  | "token-unavailable"
  | "network-request-failed"
  | "unexpected-response"
  | "unknown";

export type InviteJoinSuccess = {
  inviteCode: string;
  guildId: string;
  status: InviteJoinStatus;
  requestId: string;
};

export type InviteJoinError = {
  code: InviteJoinErrorCode;
  message: string;
  status?: number;
  backendCode?: string;
  requestId?: string;
};

export type InviteJoinResult =
  | {
      ok: true;
      data: InviteJoinSuccess;
    }
  | {
      ok: false;
      error: InviteJoinError;
    };

/**
 * invite join エラーを生成する。
 */
export function createInviteJoinError(error: InviteJoinError): InviteJoinError {
  return error;
}
