import type { QueryClient } from "@tanstack/react-query";
import type { MyProfile, Relationship } from "@/shared/api/api-client";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { GuildMember } from "@/shared/model/types/server";
import type { User } from "@/shared/model/types/user";

function applyMyProfileToUser(
  user: User,
  profile: MyProfile,
  avatarUrlOverride?: string | null,
): User {
  return {
    ...user,
    displayName: profile.displayName,
    customStatus: profile.statusText,
    avatar: profile.avatarKey === null ? null : (avatarUrlOverride ?? user.avatar),
  };
}

function updateRelationshipsWithMyProfile(
  relationships: Relationship[] | undefined,
  userId: string,
  profile: MyProfile,
  avatarUrlOverride?: string | null,
): Relationship[] | undefined {
  if (relationships === undefined) {
    return relationships;
  }

  return relationships.map((relationship) =>
    relationship.user.id === userId
      ? {
          ...relationship,
          user: applyMyProfileToUser(relationship.user, profile, avatarUrlOverride),
        }
      : relationship,
  );
}

function updateMembersWithMyProfile(
  members: GuildMember[] | undefined,
  userId: string,
  profile: MyProfile,
  avatarUrlOverride?: string | null,
): GuildMember[] | undefined {
  if (members === undefined) {
    return members;
  }

  return members.map((member) =>
    member.user.id === userId
      ? {
          ...member,
          user: applyMyProfileToUser(member.user, profile, avatarUrlOverride),
          avatar: profile.avatarKey === null ? null : (avatarUrlOverride ?? member.avatar),
        }
      : member,
  );
}

/**
 * `MyProfile` を auth-store の current user へ反映する。
 */
export function syncMyProfileToAuthStore(
  profile: MyProfile,
  avatarUrlOverride?: string | null,
): void {
  const { currentUser, setCurrentUser, setCustomStatus } = useAuthStore.getState();
  if (currentUser === null) {
    return;
  }

  setCurrentUser(applyMyProfileToUser(currentUser, profile, avatarUrlOverride));
  setCustomStatus(profile.statusText);
}

/**
 * `MyProfile` を主要 query cache と auth-store へ反映する。
 */
export function syncMyProfileToSessionCaches(
  queryClient: QueryClient,
  userId: string,
  profile: MyProfile,
  avatarUrlOverride?: string | null,
): void {
  queryClient.setQueryData(["myProfile", userId], profile);
  queryClient.setQueryData(["friends"], (existing: Relationship[] | undefined) =>
    updateRelationshipsWithMyProfile(existing, userId, profile, avatarUrlOverride),
  );
  queryClient.setQueriesData({ queryKey: ["members"] }, (existing: GuildMember[] | undefined) =>
    updateMembersWithMyProfile(existing, userId, profile, avatarUrlOverride),
  );
  syncMyProfileToAuthStore(profile, avatarUrlOverride);
}
