export const PermissionFlag = {
  CREATE_INVITE: 1 << 0,
  KICK_MEMBERS: 1 << 1,
  BAN_MEMBERS: 1 << 2,
  ADMINISTRATOR: 1 << 3,
  MANAGE_CHANNELS: 1 << 4,
  MANAGE_GUILD: 1 << 5,
  ADD_REACTIONS: 1 << 6,
  VIEW_AUDIT_LOG: 1 << 7,
  SEND_MESSAGES: 1 << 11,
  MANAGE_MESSAGES: 1 << 13,
  EMBED_LINKS: 1 << 14,
  ATTACH_FILES: 1 << 15,
  READ_MESSAGE_HISTORY: 1 << 16,
  MENTION_EVERYONE: 1 << 17,
  CONNECT: 1 << 20,
  SPEAK: 1 << 21,
  MUTE_MEMBERS: 1 << 22,
  MANAGE_ROLES: 1 << 28,
} as const;

export type PermissionOverwrite = {
  id: string;
  type: "role" | "member";
  allow: number;
  deny: number;
};

export function hasPermission(permissions: number, flag: number): boolean {
  return (permissions & flag) === flag;
}

export function computePermissions(
  basePermissions: number,
  overwrites: PermissionOverwrite[],
  roleIds: string[],
  userId: string,
): number {
  // Administrator bypasses all
  if (hasPermission(basePermissions, PermissionFlag.ADMINISTRATOR)) {
    return 0xffffffff;
  }

  let permissions = basePermissions;

  // Apply role overwrites
  for (const overwrite of overwrites) {
    if (overwrite.type === "role" && roleIds.includes(overwrite.id)) {
      permissions &= ~overwrite.deny;
      permissions |= overwrite.allow;
    }
  }

  // Apply member-specific overwrites
  for (const overwrite of overwrites) {
    if (overwrite.type === "member" && overwrite.id === userId) {
      permissions &= ~overwrite.deny;
      permissions |= overwrite.allow;
    }
  }

  return permissions;
}
