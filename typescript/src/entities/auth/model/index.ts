export type AuthSessionStatus = "initializing" | "authenticated" | "unauthenticated";

export type AuthUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

export type AuthSession = {
  status: AuthSessionStatus;
  user: AuthUser | null;
};

export type AuthTokenGetter = (forceRefresh?: boolean) => Promise<string | null>;

export type AuthSessionContextValue = AuthSession & {
  getIdToken: AuthTokenGetter;
};

type FirebaseTokenUserLike = {
  uid: string;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

type FirebaseIdentityUserLike = Pick<AuthUser, "uid" | "email" | "emailVerified">;

export const INITIAL_AUTH_SESSION: AuthSession = {
  status: "initializing",
  user: null,
};

/**
 * Firebase User をAuthUserに変換する。
 */
export function toAuthUser(user: FirebaseIdentityUserLike): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

/**
 * 認証済みセッションを生成する。
 */
export function createAuthenticatedSession(user: AuthUser): AuthSession {
  return {
    status: "authenticated",
    user,
  };
}

/**
 * 未認証セッションを生成する。
 */
export function createUnauthenticatedSession(): AuthSession {
  return {
    status: "unauthenticated",
    user: null,
  };
}

/**
 * 現在ユーザーからIDトークンを解決する。
 */
export async function resolveIdToken(
  currentUser: FirebaseTokenUserLike | null,
  forceRefresh = false,
): Promise<string | null> {
  if (currentUser === null) {
    return null;
  }

  return currentUser.getIdToken(forceRefresh);
}
