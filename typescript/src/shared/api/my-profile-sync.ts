import type { QueryClient } from "@tanstack/react-query";
import type { MyProfile, Relationship } from "@/shared/api/api-client";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { GuildMember } from "@/shared/model/types/server";
import type { User } from "@/shared/model/types/user";

function applyMyProfileToUser(user: User, profile: MyProfile): User {
  return {
    ...user,
    displayName: profile.displayName,
    customStatus: profile.statusText,
  };
}

function updateRelationshipsWithMyProfile(
  relationships: Relationship[] | undefined,
  userId: string,
  profile: MyProfile,
): Relationship[] | undefined {
  if (relationships === undefined) {
    return relationships;
  }

  return relationships.map((relationship) =>
    relationship.user.id === userId
      ? { ...relationship, user: applyMyProfileToUser(relationship.user, profile) }
      : relationship,
  );
}

function updateMembersWithMyProfile(
  members: GuildMember[] | undefined,
  userId: string,
  profile: MyProfile,
): GuildMember[] | undefined {
  if (members === undefined) {
    return members;
  }

  return members.map((member) =>
    member.user.id === userId
      ? { ...member, user: applyMyProfileToUser(member.user, profile) }
      : member,
  );
}

/**
 * `MyProfile` を auth-store の current user へ反映する。
 */
export function syncMyProfileToAuthStore(profile: MyProfile): void {
  const { currentUser, setCurrentUser } = useAuthStore.getState();
  if (currentUser === null) {
    return;
  }

  setCurrentUser(applyMyProfileToUser(currentUser, profile));
}

/**
 * `MyProfile` を主要 query cache と auth-store へ反映する。
 */
export function syncMyProfileToSessionCaches(
  queryClient: QueryClient,
  userId: string,
  profile: MyProfile,
): void {
  queryClient.setQueryData(["myProfile", userId], profile);
  queryClient.setQueryData(["friends"], (existing: Relationship[] | undefined) =>
    updateRelationshipsWithMyProfile(existing, userId, profile),
  );
  queryClient.setQueriesData({ queryKey: ["members"] }, (existing: GuildMember[] | undefined) =>
    updateMembersWithMyProfile(existing, userId, profile),
  );
  syncMyProfileToAuthStore(profile);
}
