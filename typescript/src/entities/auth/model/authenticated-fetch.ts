export type AuthenticatedFetchErrorCode =
  | "unauthenticated"
  | "token-unavailable"
  | "network-request-failed";

export type AuthenticatedFetchError = {
  code: AuthenticatedFetchErrorCode;
  message: string;
};

export type AuthenticatedFetchResult =
  | {
      ok: true;
      response: Response;
    }
  | {
      ok: false;
      error: AuthenticatedFetchError;
    };

export function createAuthenticatedFetchError(params: {
  code: AuthenticatedFetchErrorCode;
  message: string;
}): AuthenticatedFetchError {
  return {
    code: params.code,
    message: params.message,
  };
}
