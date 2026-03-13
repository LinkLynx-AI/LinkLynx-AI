import type { User, UserProfile } from "@/shared/model/types/user";

const EMPTY_USER: User = {
  id: "",
  username: "",
  displayName: "",
  avatar: null,
  status: "offline",
  customStatus: null,
  bot: false,
};

export const mockCurrentUser: User = EMPTY_USER;

export const mockUsers: User[] = [];

export const mockUserProfiles: Record<string, UserProfile> = {};

export const mockMyProfileMedia: Record<
  string,
  {
    avatarKey: string | null;
    bannerKey: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
  }
> = {};
