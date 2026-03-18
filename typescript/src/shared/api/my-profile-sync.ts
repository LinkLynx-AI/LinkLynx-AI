import type { QueryClient } from "@tanstack/react-query";
import type { MyProfile, Relationship } from "@/shared/api/api-client";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { useSettingsStore } from "@/shared/model/stores/settings-store";
import type { GuildMember } from "@/shared/model/types/server";
import type { User, UserProfile } from "@/shared/model/types/user";

import type { ResolvedMyProfileMediaUrls } from "./my-profile-media";

type NormalizedMyProfileMediaOverrides = {
  avatarUrl: string | null | undefined;
  bannerUrl: string | null | undefined;
};
type MyProfileMediaSyncInput =
  | ResolvedMyProfileMediaUrls
  | NormalizedMyProfileMediaOverrides
  | string
  | null
  | undefined;

function normalizeMediaOverrides(
  input: MyProfileMediaSyncInput,
): NormalizedMyProfileMediaOverrides {
  if (input === undefined) {
    return {
      avatarUrl: undefined,
      bannerUrl: undefined,
    };
  }

  if (typeof input === "string" || input === null) {
    return {
      avatarUrl: input,
      bannerUrl: undefined,
    };
  }

  return input;
}

function applyMyProfileToUser(
  user: User,
  profile: MyProfile,
  mediaInput?: MyProfileMediaSyncInput,
): User {
  const media = normalizeMediaOverrides(mediaInput);

  return {
    ...user,
    displayName: profile.displayName,
    customStatus: profile.statusText,
    avatar: profile.avatarKey === null ? null : (media.avatarUrl ?? user.avatar),
  };
}

function updateRelationshipsWithMyProfile(
  relationships: Relationship[] | undefined,
  userId: string,
  profile: MyProfile,
  mediaInput?: MyProfileMediaSyncInput,
): Relationship[] | undefined {
  if (relationships === undefined) {
    return relationships;
  }

  return relationships.map((relationship) =>
    relationship.user.id === userId
      ? {
          ...relationship,
          user: applyMyProfileToUser(relationship.user, profile, mediaInput),
        }
      : relationship,
  );
}

function updateMembersWithMyProfile(
  members: GuildMember[] | undefined,
  userId: string,
  profile: MyProfile,
  mediaInput?: MyProfileMediaSyncInput,
): GuildMember[] | undefined {
  if (members === undefined) {
    return members;
  }

  const media = normalizeMediaOverrides(mediaInput);

  return members.map((member) =>
    member.user.id === userId
      ? {
          ...member,
          user: applyMyProfileToUser(member.user, profile, media),
          avatar: profile.avatarKey === null ? null : (media.avatarUrl ?? member.avatar),
        }
      : member,
  );
}

function buildUserProfileForCurrentUser(
  profile: MyProfile,
  mediaInput: MyProfileMediaSyncInput,
  existing: UserProfile | undefined,
): UserProfile | undefined {
  const currentUser = useAuthStore.getState().currentUser;
  if (existing === undefined && currentUser === null) {
    return existing;
  }

  const media = normalizeMediaOverrides(mediaInput);
  const baseUser = currentUser ? applyMyProfileToUser(currentUser, profile, media) : existing;
  if (baseUser === undefined) {
    return existing;
  }

  return {
    ...(existing ?? {
      ...baseUser,
      banner: null,
      bio: null,
      accentColor: null,
      badges: [],
      createdAt: new Date(0).toISOString(),
    }),
    ...baseUser,
    banner: profile.bannerKey === null ? null : (media.bannerUrl ?? existing?.banner ?? null),
    bio: profile.statusText,
  };
}

/**
 * `MyProfile` を auth-store の current user へ反映する。
 */
export function syncMyProfileToAuthStore(
  profile: MyProfile,
  mediaInput?: MyProfileMediaSyncInput,
): void {
  const { currentUser, setCurrentUser, setCustomStatus } = useAuthStore.getState();
  useSettingsStore.getState().setTheme(profile.theme);
  if (currentUser === null) {
    return;
  }

  setCurrentUser(applyMyProfileToUser(currentUser, profile, mediaInput));
  setCustomStatus(profile.statusText);
}

/**
 * `MyProfile` を主要 query cache と auth-store へ反映する。
 */
export function syncMyProfileToSessionCaches(
  queryClient: QueryClient,
  userId: string,
  profile: MyProfile,
  mediaInput?: MyProfileMediaSyncInput,
): void {
  queryClient.setQueryData(["myProfile", userId], profile);
  queryClient.setQueryData(["friends"], (existing: Relationship[] | undefined) =>
    updateRelationshipsWithMyProfile(existing, userId, profile, mediaInput),
  );
  queryClient.setQueriesData({ queryKey: ["members"] }, (existing: GuildMember[] | undefined) =>
    updateMembersWithMyProfile(existing, userId, profile, mediaInput),
  );
  queryClient.setQueryData(["userProfile", userId], (existing: UserProfile | undefined) =>
    buildUserProfileForCurrentUser(profile, mediaInput, existing),
  );
  syncMyProfileToAuthStore(profile, mediaInput);
}
