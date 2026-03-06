import type {
  User,
  UserProfile,
  Guild,
  GuildMember,
  Channel,
  Message,
  CreateMessageData,
  EditMessageData,
} from "@/shared/model/types";

export type SearchParams = {
  content?: string;
  authorId?: string;
  channelId?: string;
  has?: string;
  before?: string;
  after?: string;
  limit?: number;
  offset?: number;
};

export type SearchResult = {
  messages: Message[][];
  totalResults: number;
};

export type MyProfile = {
  displayName: string;
  statusText: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
};

export type UpdateMyProfileInput = {
  displayName?: string;
  statusText?: string | null;
  avatarKey?: string | null;
  bannerKey?: string | null;
};

export type CreateGuildData = {
  name: string;
  icon?: string;
};

export type UpdateGuildData = {
  name?: string;
  icon?: string | null;
};

export type CreateChannelData = {
  name: string;
  type: number;
  parentId?: string;
  topic?: string;
};

export type CreateInviteData = {
  maxAge?: number;
  maxUses?: number;
};

export type Invite = {
  code: string;
  guild: Guild;
  channel: Channel;
  expiresAt: string | null;
  uses: number;
  maxUses: number;
};

export type Role = {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: number;
  hoist: boolean;
  mentionable: boolean;
  memberCount: number;
};

export type Webhook = {
  id: string;
  name: string;
  channelId: string;
  avatar: string | null;
  token?: string;
};

export type AuditLogEntry = {
  id: string;
  actionType: number;
  userId: string;
  targetId?: string;
  changes?: Record<string, unknown>[];
  reason?: string;
  createdAt: string;
};

export type RelationshipType = 1 | 2 | 3 | 4; // friend | blocked | incoming | outgoing

export type Relationship = {
  id: string;
  type: RelationshipType;
  user: User;
};

export type ModerationTargetType = "message" | "user";
export type ModerationReportStatus = "open" | "resolved";

export type ModerationReport = {
  reportId: string;
  guildId: string;
  reporterId: string;
  targetType: ModerationTargetType;
  targetId: string;
  reason: string;
  status: ModerationReportStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ModerationMute = {
  muteId: string;
  guildId: string;
  targetUserId: string;
  reason: string;
  createdBy: string;
  expiresAt: string | null;
  createdAt: string;
};

export type CreateModerationReportData = {
  targetType: ModerationTargetType;
  targetId: string;
  reason: string;
};

export type CreateModerationMuteData = {
  targetUserId: string;
  reason: string;
  expiresAt?: string | null;
};

export type APIClient = {
  // Auth
  getCurrentUser(): Promise<User>;

  // Guilds (Servers)
  getServers(): Promise<Guild[]>;
  getServer(serverId: string): Promise<Guild>;
  createServer(data: CreateGuildData): Promise<Guild>;
  updateServer(serverId: string, data: UpdateGuildData): Promise<Guild>;
  deleteServer(serverId: string): Promise<void>;
  leaveServer(serverId: string): Promise<void>;

  // Channels
  getChannels(serverId: string): Promise<Channel[]>;
  getChannel(channelId: string): Promise<Channel>;
  createChannel(serverId: string, data: CreateChannelData): Promise<Channel>;
  updateChannel(channelId: string, data: Partial<Channel>): Promise<Channel>;
  deleteChannel(channelId: string): Promise<void>;

  // Messages
  getMessages(
    channelId: string,
    params?: { before?: string; after?: string; limit?: number },
  ): Promise<Message[]>;
  getMessage(channelId: string, messageId: string): Promise<Message>;
  sendMessage(channelId: string, data: CreateMessageData): Promise<Message>;
  editMessage(channelId: string, messageId: string, data: EditMessageData): Promise<Message>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;
  getPinnedMessages(channelId: string): Promise<Message[]>;

  // Reactions
  addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  removeReaction(channelId: string, messageId: string, emoji: string): Promise<void>;

  // Members
  getMembers(serverId: string, params?: { limit?: number; after?: string }): Promise<GuildMember[]>;
  getMember(serverId: string, userId: string): Promise<GuildMember>;

  // Users
  getUser(userId: string): Promise<User>;
  getUserProfile(userId: string): Promise<UserProfile>;
  getMyProfile(): Promise<MyProfile>;
  updateMyProfile(input: UpdateMyProfileInput): Promise<MyProfile>;

  // Relationships (Friends)
  getFriends(): Promise<Relationship[]>;
  sendFriendRequest(username: string): Promise<void>;
  acceptFriendRequest(userId: string): Promise<void>;
  removeFriend(userId: string): Promise<void>;
  blockUser(userId: string): Promise<void>;

  // DMs
  getDMChannels(): Promise<Channel[]>;
  createDM(recipientId: string): Promise<Channel>;
  createGroupDM(recipientIds: string[]): Promise<Channel>;

  // Invites
  createInvite(channelId: string, data: CreateInviteData): Promise<Invite>;
  getInvites(serverId: string): Promise<Invite[]>;
  revokeInvite(inviteCode: string): Promise<void>;

  // Roles
  getRoles(serverId: string): Promise<Role[]>;
  createRole(
    serverId: string,
    data: { name: string; color?: string; permissions?: number },
  ): Promise<Role>;
  updateRole(serverId: string, roleId: string, data: Partial<Role>): Promise<Role>;
  deleteRole(serverId: string, roleId: string): Promise<void>;
  reorderRoles(serverId: string, roles: { id: string; position: number }[]): Promise<void>;

  // Webhooks
  getWebhooks(channelId: string): Promise<Webhook[]>;
  createWebhook(channelId: string, data: { name: string; avatar?: string }): Promise<Webhook>;
  deleteWebhook(webhookId: string): Promise<void>;

  // Audit Log
  getAuditLog(
    serverId: string,
    params?: { before?: string; limit?: number },
  ): Promise<AuditLogEntry[]>;

  // Message moderation
  pinMessage(channelId: string, messageId: string): Promise<void>;
  unpinMessage(channelId: string, messageId: string): Promise<void>;

  // Member moderation
  kickMember(serverId: string, userId: string): Promise<void>;
  banMember(serverId: string, userId: string, data?: { deleteMessageDays?: number }): Promise<void>;
  timeoutMember(serverId: string, userId: string, until: string | null): Promise<void>;
  updateMemberNickname(serverId: string, userId: string, nickname: string): Promise<void>;

  // Moderation reports and mutes
  getModerationReports(serverId: string): Promise<ModerationReport[]>;
  getModerationReport(serverId: string, reportId: string): Promise<ModerationReport>;
  createModerationReport(
    serverId: string,
    data: CreateModerationReportData,
  ): Promise<ModerationReport>;
  resolveModerationReport(serverId: string, reportId: string): Promise<ModerationReport>;
  reopenModerationReport(serverId: string, reportId: string): Promise<ModerationReport>;
  createModerationMute(serverId: string, data: CreateModerationMuteData): Promise<ModerationMute>;

  // Typing
  triggerTyping(channelId: string): Promise<void>;

  // Search
  searchMessages(serverId: string, params: SearchParams): Promise<SearchResult>;
};

// Singleton instance
let apiInstance: APIClient | undefined;

export function getAPIClient(): APIClient {
  if (!apiInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GuildChannelAPIClient } = require("./guild-channel-api-client");
    apiInstance = new GuildChannelAPIClient() as APIClient;
  }
  return apiInstance;
}
