import type {
  User,
  UserProfile,
  Guild,
  GuildMember,
  Channel,
  Message,
  CreateMessageData,
  EditMessageData,
  DeleteMessageData,
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

export type MessageQueryParams = {
  guildId?: string | null;
  channelId: string;
  before?: string;
  after?: string;
  limit?: number;
};

export type SendMessageParams = {
  guildId?: string | null;
  channelId: string;
  data: CreateMessageData;
};

export type MessagePage = {
  items: Message[];
  nextBefore: string | null;
  nextAfter: string | null;
  hasMore: boolean;
};

export type MyProfile = {
  displayName: string;
  statusText: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
  theme: "dark" | "light";
};

export type UpdateMyProfileInput = {
  displayName?: string;
  statusText?: string | null;
  avatarKey?: string | null;
  bannerKey?: string | null;
  theme?: "dark" | "light";
};

export type ProfileMediaTarget = "avatar" | "banner";

export type CreateMyProfileMediaUploadUrlInput = {
  target: ProfileMediaTarget;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type MyProfileMediaUpload = {
  target: ProfileMediaTarget;
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
  method: "PUT";
  requiredHeaders: Record<string, string>;
};

export type MyProfileMediaDownload = {
  target: ProfileMediaTarget;
  objectKey: string;
  downloadUrl: string;
  expiresAt: string;
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
  maxUses: number | null;
};

export type InviteListItem = {
  code: string;
  channel: {
    id: string;
    name: string;
  } | null;
  creator: {
    id: string;
    displayName: string;
  } | null;
  expiresAt: string | null;
  uses: number;
  maxUses: number | null;
  createdAt: string;
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
  allowView: boolean;
  allowPost: boolean;
  allowManage: boolean;
  isSystem: boolean;
};

export type PermissionOverrideValue = "allow" | "deny" | "inherit";

export type ChannelRolePermissionOverride = {
  roleKey: string;
  subjectName: string;
  isSystem: boolean;
  canView: PermissionOverrideValue;
  canPost: PermissionOverrideValue;
};

export type ChannelUserPermissionOverride = {
  userId: string;
  subjectName: string;
  canView: PermissionOverrideValue;
  canPost: PermissionOverrideValue;
};

export type ChannelPermissions = {
  roleOverrides: ChannelRolePermissionOverride[];
  userOverrides: ChannelUserPermissionOverride[];
};

export type CreateRoleInput = {
  name: string;
  allowView: boolean;
  allowPost: boolean;
  allowManage: boolean;
};

export type UpdateRoleInput = {
  name?: string;
  allowView?: boolean;
  allowPost?: boolean;
  allowManage?: boolean;
};

export type ReplaceChannelPermissionsInput = {
  roleOverrides: Array<{
    roleKey: string;
    canView: PermissionOverrideValue;
    canPost: PermissionOverrideValue;
  }>;
  userOverrides: Array<{
    userId: string;
    canView: PermissionOverrideValue;
    canPost: PermissionOverrideValue;
  }>;
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

export type GuildPermissionSnapshot = {
  canView: boolean;
  canCreateChannel: boolean;
  canCreateInvite: boolean;
  canManageSettings: boolean;
  canModerate: boolean;
};

export type ChannelPermissionSnapshot = {
  canView: boolean;
  canPost: boolean;
  canManage: boolean;
};

/**
 * permission snapshot 契約を表す。
 *
 * Contract:
 * - backend の numeric ID を frontend では string として扱う
 * - channel 指定なしの snapshot では `channel` と `channelId` は `null`
 */
export type PermissionSnapshot = {
  /** backend i64 を string へ変換した guild ID。 */
  guildId: string;
  /** backend i64 を string へ変換した channel ID。未指定時は `null`。 */
  channelId: string | null;
  guild: GuildPermissionSnapshot;
  channel: ChannelPermissionSnapshot | null;
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
  getMessages(params: MessageQueryParams): Promise<MessagePage>;
  getMessage(channelId: string, messageId: string): Promise<Message>;
  sendMessage(params: SendMessageParams): Promise<Message>;
  editMessage(channelId: string, messageId: string, data: EditMessageData): Promise<Message>;
  deleteMessage(channelId: string, messageId: string, data: DeleteMessageData): Promise<Message>;
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
  createMyProfileMediaUploadUrl(
    input: CreateMyProfileMediaUploadUrlInput,
  ): Promise<MyProfileMediaUpload>;
  getMyProfileMediaDownloadUrl(target: ProfileMediaTarget): Promise<MyProfileMediaDownload>;

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
  createInvite(serverId: string, channelId: string, data: CreateInviteData): Promise<Invite>;
  getInvites(serverId: string, options?: { channelId?: string }): Promise<InviteListItem[]>;
  revokeInvite(
    serverId: string,
    inviteCode: string,
    options?: { channelId?: string },
  ): Promise<void>;

  // Roles
  getRoles(serverId: string): Promise<Role[]>;
  createRole(serverId: string, data: CreateRoleInput): Promise<Role>;
  updateRole(serverId: string, roleId: string, data: UpdateRoleInput): Promise<Role>;
  deleteRole(serverId: string, roleId: string): Promise<void>;
  reorderRoles(serverId: string, roleKeys: string[]): Promise<Role[]>;
  replaceMemberRoles(serverId: string, memberId: string, roleKeys: string[]): Promise<GuildMember>;
  getChannelPermissions(serverId: string, channelId: string): Promise<ChannelPermissions>;
  replaceChannelPermissions(
    serverId: string,
    channelId: string,
    data: ReplaceChannelPermissionsInput,
  ): Promise<ChannelPermissions>;

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

  // AuthZ snapshot
  getPermissionSnapshot(
    serverId: string,
    params?: { channelId?: string | null },
  ): Promise<PermissionSnapshot>;

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
