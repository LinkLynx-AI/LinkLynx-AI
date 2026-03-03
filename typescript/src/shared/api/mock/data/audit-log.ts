export type AuditLogEntry = {
  id: string;
  userId: string;
  username: string;
  userAvatar: string | null;
  actionType:
    | "channel_create"
    | "channel_delete"
    | "channel_update"
    | "role_create"
    | "role_update"
    | "member_kick"
    | "member_ban"
    | "member_unban"
    | "message_delete"
    | "invite_create";
  targetName: string;
  reason?: string;
  changes?: { key: string; oldValue: string; newValue: string }[];
  createdAt: string;
};

export const mockAuditLogEntries: AuditLogEntry[] = [];
