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
