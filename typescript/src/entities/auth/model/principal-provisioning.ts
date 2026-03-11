export type PrincipalProvisionErrorCode =
  | "unauthenticated"
  | "token-unavailable"
  | "email-not-verified"
  | "principal-not-mapped"
  | "auth-unavailable"
  | "network-request-failed"
  | "unexpected-response"
  | "unknown";

export type PrincipalProvisionError = {
  code: PrincipalProvisionErrorCode;
  message: string;
  backendCode: string | null;
  requestId: string | null;
  status: number | null;
};

export type PrincipalProvisionResult =
  | {
      ok: true;
      data: {
        principalId: string;
        firebaseUid: string;
        requestId: string;
      };
    }
  | {
      ok: false;
      error: PrincipalProvisionError;
    };

export function createPrincipalProvisionError(params: {
  code: PrincipalProvisionErrorCode;
  message: string;
  backendCode?: string | null;
  requestId?: string | null;
  status?: number | null;
}): PrincipalProvisionError {
  return {
    code: params.code,
    message: params.message,
    backendCode: params.backendCode ?? null,
    requestId: params.requestId ?? null,
    status: params.status ?? null,
  };
}
