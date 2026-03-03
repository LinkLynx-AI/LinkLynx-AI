import type { User } from "./user";

export type Guild = {
  id: string;
  name: string;
  icon: string | null;
  banner: string | null;
  ownerId: string;
  memberCount: number;
  boostLevel: number;
  boostCount: number;
  features: GuildFeature[];
  description: string | null;
};

export type GuildFeature =
  | "COMMUNITY"
  | "INVITE_SPLASH"
  | "VERIFIED"
  | "PARTNERED"
  | "DISCOVERABLE"
  | "ANIMATED_ICON"
  | "BANNER";

export type GuildMember = {
  user: User;
  nick: string | null;
  roles: string[];
  joinedAt: string;
  avatar: string | null;
};

export type Role = {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  mentionable: boolean;
  hoist: boolean;
  memberCount: number;
};
