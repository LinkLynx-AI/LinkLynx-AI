import type { QueryClient } from "@tanstack/react-query";
import type { MyProfile, Relationship } from "@/shared/api/api-client";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { useSettingsStore } from "@/shared/model/stores/settings-store";
import type { GuildMember } from "@/shared/model/types/server";
import type { User, UserProfile } from "@/shared/model/types/user";

import type { ResolvedMyProfileMediaUrls } from "./my-profile-media";

function applyMyProfileToUser(
  user: User,
  profile: MyProfile,
  mediaUrls?: ResolvedMyProfileMediaUrls,
): User {
  return {
    ...user,
    displayName: profile.displayName,
    avatar: mediaUrls?.avatarUrl ?? user.avatar,
    customStatus: profile.statusText,
  };
}

function updateRelationshipsWithMyProfile(
  relationships: Relationship[] | undefined,
  userId: string,
  profile: MyProfile,
  mediaUrls?: ResolvedMyProfileMediaUrls,
): Relationship[] | undefined {
  if (relationships === undefined) {
    return relationships;
  }

  return relationships.map((relationship) =>
    relationship.user.id === userId
      ? { ...relationship, user: applyMyProfileToUser(relationship.user, profile, mediaUrls) }
      : relationship,
  );
}

function updateMembersWithMyProfile(
  members: GuildMember[] | undefined,
  userId: string,
  profile: MyProfile,
  mediaUrls?: ResolvedMyProfileMediaUrls,
): GuildMember[] | undefined {
  if (members === undefined) {
    return members;
  }

  return members.map((member) =>
    member.user.id === userId
      ? { ...member, user: applyMyProfileToUser(member.user, profile, mediaUrls) }
      : member,
  );
}

function buildUserProfileForCurrentUser(
  profile: MyProfile,
  mediaUrls: ResolvedMyProfileMediaUrls | undefined,
  existing: UserProfile | undefined,
): UserProfile | undefined {
  const currentUser = useAuthStore.getState().currentUser;
  if (existing === undefined && currentUser === null) {
    return existing;
  }

  const baseUser = currentUser
    ? applyMyProfileToUser(currentUser, profile, mediaUrls)
    : existing;
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
    banner: mediaUrls?.bannerUrl ?? existing?.banner ?? null,
    bio: profile.statusText,
  };
}

/**
 * `MyProfile` を auth-store の current user へ反映する。
 */
export function syncMyProfileToAuthStore(
  profile: MyProfile,
  mediaUrls?: ResolvedMyProfileMediaUrls,
): void {
  const { currentUser, setCurrentUser } = useAuthStore.getState();
  useSettingsStore.getState().setTheme(profile.theme);
  if (currentUser === null) {
    return;
  }

  setCurrentUser(applyMyProfileToUser(currentUser, profile, mediaUrls));
}

/**
 * `MyProfile` を主要 query cache と auth-store へ反映する。
 */
export function syncMyProfileToSessionCaches(
  queryClient: QueryClient,
  userId: string,
  profile: MyProfile,
  mediaUrls?: ResolvedMyProfileMediaUrls,
): void {
  queryClient.setQueryData(["myProfile", userId], profile);
  queryClient.setQueryData(["friends"], (existing: Relationship[] | undefined) =>
    updateRelationshipsWithMyProfile(existing, userId, profile, mediaUrls),
  );
  queryClient.setQueriesData({ queryKey: ["members"] }, (existing: GuildMember[] | undefined) =>
    updateMembersWithMyProfile(existing, userId, profile, mediaUrls),
  );
  queryClient.setQueryData(["userProfile", userId], (existing: UserProfile | undefined) =>
    buildUserProfileForCurrentUser(profile, mediaUrls, existing),
  );
  syncMyProfileToAuthStore(profile, mediaUrls);
}
