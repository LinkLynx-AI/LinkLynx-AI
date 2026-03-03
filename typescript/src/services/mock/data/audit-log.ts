export interface AuditLogEntry {
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
}

export const mockAuditLogEntries: AuditLogEntry[] = [
  {
    id: "al-1",
    userId: "1",
    username: "alice",
    userAvatar: null,
    actionType: "channel_create",
    targetName: "#announcements",
    createdAt: "2025-12-01T10:30:00Z",
  },
  {
    id: "al-2",
    userId: "2",
    username: "bob",
    userAvatar: null,
    actionType: "role_create",
    targetName: "VIP",
    createdAt: "2025-12-01T09:15:00Z",
  },
  {
    id: "al-3",
    userId: "1",
    username: "alice",
    userAvatar: null,
    actionType: "member_ban",
    targetName: "spammer42",
    reason: "スパム行為",
    createdAt: "2025-11-30T22:00:00Z",
  },
  {
    id: "al-4",
    userId: "3",
    username: "charlie",
    userAvatar: null,
    actionType: "channel_update",
    targetName: "#general",
    changes: [
      { key: "name", oldValue: "chat", newValue: "general" },
      { key: "topic", oldValue: "", newValue: "一般的な会話" },
    ],
    createdAt: "2025-11-30T18:45:00Z",
  },
  {
    id: "al-5",
    userId: "2",
    username: "bob",
    userAvatar: null,
    actionType: "member_kick",
    targetName: "troublemaker",
    reason: "ルール違反",
    createdAt: "2025-11-30T15:20:00Z",
  },
  {
    id: "al-6",
    userId: "1",
    username: "alice",
    userAvatar: null,
    actionType: "invite_create",
    targetName: "discord.gg/abc123",
    createdAt: "2025-11-29T12:00:00Z",
  },
  {
    id: "al-7",
    userId: "3",
    username: "charlie",
    userAvatar: null,
    actionType: "message_delete",
    targetName: "#general",
    reason: "不適切な内容",
    createdAt: "2025-11-29T08:30:00Z",
  },
  {
    id: "al-8",
    userId: "2",
    username: "bob",
    userAvatar: null,
    actionType: "role_update",
    targetName: "Moderator",
    changes: [{ key: "color", oldValue: "#3498db", newValue: "#2980b9" }],
    createdAt: "2025-11-28T20:10:00Z",
  },
  {
    id: "al-9",
    userId: "1",
    username: "alice",
    userAvatar: null,
    actionType: "channel_delete",
    targetName: "#old-channel",
    createdAt: "2025-11-28T14:00:00Z",
  },
  {
    id: "al-10",
    userId: "3",
    username: "charlie",
    userAvatar: null,
    actionType: "member_unban",
    targetName: "reformed_user",
    createdAt: "2025-11-27T11:45:00Z",
  },
  {
    id: "al-11",
    userId: "2",
    username: "bob",
    userAvatar: null,
    actionType: "channel_create",
    targetName: "#voice-lounge",
    createdAt: "2025-11-27T09:00:00Z",
  },
  {
    id: "al-12",
    userId: "1",
    username: "alice",
    userAvatar: null,
    actionType: "role_create",
    targetName: "Event Staff",
    createdAt: "2025-11-26T16:30:00Z",
  },
];
