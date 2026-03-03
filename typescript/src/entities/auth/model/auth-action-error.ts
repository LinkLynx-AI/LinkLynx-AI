export type AuthActionErrorCode =
  | "invalid-credentials"
  | "invalid-email"
  | "email-already-in-use"
  | "weak-password"
  | "user-not-found"
  | "popup-closed-by-user"
  | "popup-blocked"
  | "cancelled-popup-request"
  | "account-exists-with-different-credential"
  | "too-many-requests"
  | "network-request-failed"
  | "operation-not-allowed"
  | "requires-recent-login"
  | "unauthenticated"
  | "unknown";

export type AuthActionError = {
  code: AuthActionErrorCode;
  message: string;
  firebaseCode: string | null;
};

export type AuthActionResult<T> = { ok: true; data: T } | { ok: false; error: AuthActionError };

export function createManualAuthActionError(params: {
  code: AuthActionErrorCode;
  message: string;
  firebaseCode?: string | null;
}): AuthActionError {
  return {
    code: params.code,
    message: params.message,
    firebaseCode: params.firebaseCode ?? null,
  };
}
