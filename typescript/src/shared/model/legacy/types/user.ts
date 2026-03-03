export type UserStatus = "online" | "idle" | "dnd" | "offline";

export type User = {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  status: UserStatus;
  customStatus: string | null;
  bot: boolean;
};

export type UserProfile = {
  banner: string | null;
  bio: string | null;
  accentColor: number | null;
  badges: UserBadge[];
  createdAt: string;
} & User;

export type UserBadge =
  | "nitro"
  | "boost"
  | "developer"
  | "bug_hunter"
  | "hypesquad_bravery"
  | "hypesquad_brilliance"
  | "hypesquad_balance"
  | "early_supporter"
  | "active_developer";
