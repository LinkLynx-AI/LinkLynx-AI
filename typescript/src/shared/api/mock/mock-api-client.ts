import type {
  APIClient,
  CreateGuildData,
  CreateChannelData,
  CreateInviteData,
  Invite,
  Role,
  Webhook,
  AuditLogEntry,
  Relationship,
  SearchParams,
  SearchResult,
} from "../api-client";
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
import {
  mockCurrentUser,
  mockUsers,
  mockUserProfiles,
  mockServers,
  mockMembers,
  mockChannels,
  mockDMChannels,
  mockMessages,
  mockFriendships,
  mockInvites,
  mockAuditLogEntries,
  mockWebhooks,
  mockRolesData,
} from "./data";

export class MockAPIClient implements APIClient {
  private delay = 100;

  private async simulateDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.delay));
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  }

  // Auth
  async getCurrentUser(): Promise<User> {
    await this.simulateDelay();
    return mockCurrentUser;
  }

  // Guilds
  async getServers(): Promise<Guild[]> {
    await this.simulateDelay();
    return mockServers;
  }

  async getServer(serverId: string): Promise<Guild> {
    await this.simulateDelay();
    const server = mockServers.find((s) => s.id === serverId);
    if (!server) throw new Error("Server not found");
    return server;
  }

  async createServer(data: CreateGuildData): Promise<Guild> {
    await this.simulateDelay();
    const guild: Guild = {
      id: this.generateId(),
      name: data.name,
      icon: data.icon ?? null,
      banner: null,
      ownerId: mockCurrentUser.id,
      memberCount: 1,
      boostLevel: 0,
      boostCount: 0,
      features: [],
      description: null,
    };
    mockServers.push(guild);
    return guild;
  }

  async updateServer(serverId: string, data: Partial<Guild>): Promise<Guild> {
    await this.simulateDelay();
    const idx = mockServers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error("Server not found");
    mockServers[idx] = { ...mockServers[idx], ...data };
    return mockServers[idx];
  }

  async deleteServer(serverId: string): Promise<void> {
    await this.simulateDelay();
    const idx = mockServers.findIndex((s) => s.id === serverId);
    if (idx !== -1) mockServers.splice(idx, 1);
  }

  async leaveServer(_serverId: string): Promise<void> {
    await this.simulateDelay();
  }

  // Channels
  async getChannels(serverId: string): Promise<Channel[]> {
    await this.simulateDelay();
    return mockChannels[serverId] ?? [];
  }

  async getChannel(channelId: string): Promise<Channel> {
    await this.simulateDelay();
    for (const channels of Object.values(mockChannels)) {
      const ch = channels.find((c) => c.id === channelId);
      if (ch) return ch;
    }
    const dm = mockDMChannels.find((c) => c.id === channelId);
    if (dm) return dm;
    throw new Error("Channel not found");
  }

  async createChannel(serverId: string, data: CreateChannelData): Promise<Channel> {
    await this.simulateDelay();
    const channel: Channel = {
      id: this.generateId(),
      type: data.type as Channel["type"],
      guildId: serverId,
      name: data.name,
      topic: data.topic ?? null,
      position: mockChannels[serverId]?.length ?? 0,
      parentId: data.parentId ?? null,
      nsfw: false,
      rateLimitPerUser: 0,
      lastMessageId: null,
    };
    if (!mockChannels[serverId]) mockChannels[serverId] = [];
    mockChannels[serverId].push(channel);
    return channel;
  }

  async updateChannel(channelId: string, data: Partial<Channel>): Promise<Channel> {
    await this.simulateDelay();
    for (const channels of Object.values(mockChannels)) {
      const idx = channels.findIndex((c) => c.id === channelId);
      if (idx !== -1) {
        channels[idx] = { ...channels[idx], ...data };
        return channels[idx];
      }
    }
    throw new Error("Channel not found");
  }

  async deleteChannel(channelId: string): Promise<void> {
    await this.simulateDelay();
    for (const [serverId, channels] of Object.entries(mockChannels)) {
      const idx = channels.findIndex((c) => c.id === channelId);
      if (idx !== -1) {
        mockChannels[serverId].splice(idx, 1);
        return;
      }
    }
  }

  // Messages
  async getMessages(
    channelId: string,
    params?: { before?: string; after?: string; limit?: number },
  ): Promise<Message[]> {
    await this.simulateDelay();
    const messages = mockMessages[channelId] ?? [];
    const limit = params?.limit ?? 50;
    return messages.slice(-limit);
  }

  async getMessage(channelId: string, messageId: string): Promise<Message> {
    await this.simulateDelay();
    const messages = mockMessages[channelId] ?? [];
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) throw new Error("Message not found");
    return msg;
  }

  async sendMessage(channelId: string, data: CreateMessageData): Promise<Message> {
    await this.simulateDelay();
    const message: Message = {
      id: this.generateId(),
      channelId,
      author: mockCurrentUser,
      content: data.content,
      timestamp: new Date().toISOString(),
      editedTimestamp: null,
      type: data.referencedMessageId ? 19 : 0,
      pinned: false,
      mentionEveryone: false,
      mentions: [],
      attachments: [],
      embeds: [],
      reactions: [],
      referencedMessage: null,
    };
    if (!mockMessages[channelId]) mockMessages[channelId] = [];
    mockMessages[channelId].push(message);
    return message;
  }

  async editMessage(channelId: string, messageId: string, data: EditMessageData): Promise<Message> {
    await this.simulateDelay();
    const messages = mockMessages[channelId] ?? [];
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) throw new Error("Message not found");
    messages[idx] = {
      ...messages[idx],
      content: data.content,
      editedTimestamp: new Date().toISOString(),
    };
    return messages[idx];
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.simulateDelay();
    const messages = mockMessages[channelId] ?? [];
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) messages.splice(idx, 1);
  }

  async getPinnedMessages(channelId: string): Promise<Message[]> {
    await this.simulateDelay();
    const messages = mockMessages[channelId] ?? [];
    return messages.filter((m) => m.pinned);
  }

  // Reactions
  async addReaction(_channelId: string, _messageId: string, _emoji: string): Promise<void> {
    await this.simulateDelay();
  }

  async removeReaction(_channelId: string, _messageId: string, _emoji: string): Promise<void> {
    await this.simulateDelay();
  }

  // Members
  async getMembers(
    serverId: string,
    _params?: { limit?: number; after?: string },
  ): Promise<GuildMember[]> {
    await this.simulateDelay();
    return mockMembers[serverId] ?? [];
  }

  async getMember(serverId: string, userId: string): Promise<GuildMember> {
    await this.simulateDelay();
    const members = mockMembers[serverId] ?? [];
    const member = members.find((m) => m.user.id === userId);
    if (!member) throw new Error("Member not found");
    return member;
  }

  // Users
  async getUser(userId: string): Promise<User> {
    await this.simulateDelay();
    const user = mockUsers.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    return user;
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    await this.simulateDelay();
    const profile = mockUserProfiles[userId];
    if (!profile) {
      const user = mockUsers.find((u) => u.id === userId);
      if (!user) throw new Error("User not found");
      return {
        ...user,
        banner: null,
        bio: null,
        accentColor: null,
        badges: [],
        createdAt: "2022-01-01T00:00:00.000Z",
      };
    }
    return profile;
  }

  // Relationships
  async getFriends(): Promise<Relationship[]> {
    await this.simulateDelay();
    return [...mockFriendships];
  }

  async sendFriendRequest(username: string): Promise<void> {
    await this.simulateDelay();
    const user = mockUsers.find((u) => u.username === username);
    if (!user) throw new Error("ユーザーが見つかりませんでした。ユーザー名を確認してください。");
    if (user.id === mockCurrentUser.id)
      throw new Error("自分自身にフレンドリクエストは送れません。");
    const existing = mockFriendships.find((r) => r.user.id === user.id);
    if (existing) throw new Error("既にフレンドリクエストを送信済みです。");
    mockFriendships.push({
      id: this.generateId(),
      type: 4, // outgoing
      user,
    });
  }

  async acceptFriendRequest(userId: string): Promise<void> {
    await this.simulateDelay();
    const idx = mockFriendships.findIndex((r) => r.user.id === userId && r.type === 3);
    if (idx === -1) throw new Error("Friend request not found");
    mockFriendships[idx] = { ...mockFriendships[idx], type: 1 };
  }

  async removeFriend(userId: string): Promise<void> {
    await this.simulateDelay();
    const idx = mockFriendships.findIndex((r) => r.user.id === userId);
    if (idx !== -1) mockFriendships.splice(idx, 1);
  }

  async blockUser(userId: string): Promise<void> {
    await this.simulateDelay();
    const idx = mockFriendships.findIndex((r) => r.user.id === userId);
    if (idx !== -1) {
      mockFriendships[idx] = { ...mockFriendships[idx], type: 2 };
    } else {
      const user = mockUsers.find((u) => u.id === userId);
      if (!user) throw new Error("User not found");
      mockFriendships.push({
        id: this.generateId(),
        type: 2, // blocked
        user,
      });
    }
  }

  // DMs
  async getDMChannels(): Promise<Channel[]> {
    await this.simulateDelay();
    return mockDMChannels;
  }

  async createDM(_recipientId: string): Promise<Channel> {
    await this.simulateDelay();
    return mockDMChannels[0];
  }

  async createGroupDM(_recipientIds: string[]): Promise<Channel> {
    await this.simulateDelay();
    return mockDMChannels[0];
  }

  // Invites
  async createInvite(channelId: string, _data: CreateInviteData): Promise<Invite> {
    await this.simulateDelay();
    return {
      code: "abc123",
      guild: mockServers[0],
      channel: (mockChannels[mockServers[0].id] ?? [])[0] ?? ({} as Channel),
      expiresAt: null,
      uses: 0,
      maxUses: 0,
    };
  }

  async getInvites(_serverId: string): Promise<Invite[]> {
    await this.simulateDelay();
    return mockInvites.map((inv) => ({
      code: inv.code,
      guild: mockServers[0],
      channel: (mockChannels[mockServers[0].id] ?? [])[0] ?? ({} as Channel),
      expiresAt: inv.expiresAt,
      uses: inv.uses,
      maxUses: inv.maxUses ?? 0,
    }));
  }

  async revokeInvite(_inviteCode: string): Promise<void> {
    await this.simulateDelay();
  }

  // Roles
  async getRoles(_serverId: string): Promise<Role[]> {
    await this.simulateDelay();
    return mockRolesData.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      position: r.position,
      permissions: r.permissions,
      hoist: r.hoist,
      mentionable: r.mentionable,
      memberCount: r.memberCount,
    }));
  }

  async createRole(
    _serverId: string,
    data: { name: string; color?: string; permissions?: number },
  ): Promise<Role> {
    await this.simulateDelay();
    return {
      id: this.generateId(),
      name: data.name,
      color: data.color ?? "#95a5a6",
      position: mockRolesData.length,
      permissions: data.permissions ?? 0,
      hoist: false,
      mentionable: false,
      memberCount: 0,
    };
  }

  async updateRole(_serverId: string, roleId: string, data: Partial<Role>): Promise<Role> {
    await this.simulateDelay();
    const role = mockRolesData.find((r) => r.id === roleId);
    if (!role) throw new Error("Role not found");
    return { ...role, ...data } as Role;
  }

  async deleteRole(_serverId: string, _roleId: string): Promise<void> {
    await this.simulateDelay();
  }

  async reorderRoles(_serverId: string, _roles: { id: string; position: number }[]): Promise<void> {
    await this.simulateDelay();
  }

  // Webhooks
  async getWebhooks(_channelId: string): Promise<Webhook[]> {
    await this.simulateDelay();
    return mockWebhooks.map((wh) => ({
      id: wh.id,
      name: wh.name,
      channelId: wh.channelId,
      avatar: wh.avatar,
      token: wh.token,
    }));
  }

  async createWebhook(
    channelId: string,
    data: { name: string; avatar?: string },
  ): Promise<Webhook> {
    await this.simulateDelay();
    return {
      id: this.generateId(),
      name: data.name,
      channelId,
      avatar: data.avatar ?? null,
    };
  }

  async deleteWebhook(_webhookId: string): Promise<void> {
    await this.simulateDelay();
  }

  // Audit Log
  async getAuditLog(
    _serverId: string,
    params?: { before?: string; limit?: number },
  ): Promise<AuditLogEntry[]> {
    await this.simulateDelay();
    const limit = params?.limit ?? 50;
    const entries: AuditLogEntry[] = mockAuditLogEntries.slice(0, limit).map((e) => ({
      id: e.id,
      actionType: 0,
      userId: e.userId,
      targetId: undefined,
      changes: e.changes as Record<string, unknown>[] | undefined,
      reason: e.reason,
      createdAt: e.createdAt,
    }));
    return entries;
  }

  // Message moderation
  async pinMessage(channelId: string, messageId: string): Promise<void> {
    await this.simulateDelay();
    const messages = mockMessages[channelId] ?? [];
    const msg = messages.find((m) => m.id === messageId);
    if (msg) msg.pinned = true;
  }

  async unpinMessage(channelId: string, messageId: string): Promise<void> {
    await this.simulateDelay();
    const messages = mockMessages[channelId] ?? [];
    const msg = messages.find((m) => m.id === messageId);
    if (msg) msg.pinned = false;
  }

  // Member moderation
  async kickMember(_serverId: string, _userId: string): Promise<void> {
    await this.simulateDelay();
  }

  async banMember(
    _serverId: string,
    _userId: string,
    _data?: { deleteMessageDays?: number },
  ): Promise<void> {
    await this.simulateDelay();
  }

  async timeoutMember(_serverId: string, _userId: string, _until: string | null): Promise<void> {
    await this.simulateDelay();
  }

  async updateMemberNickname(_serverId: string, _userId: string, _nickname: string): Promise<void> {
    await this.simulateDelay();
  }

  // Typing
  async triggerTyping(_channelId: string): Promise<void> {
    await this.simulateDelay();
  }

  // Search
  async searchMessages(_serverId: string, params: SearchParams): Promise<SearchResult> {
    await this.simulateDelay();
    const allMessages = Object.values(mockMessages).flat();
    const filtered = params.content
      ? allMessages.filter((m) => m.content.toLowerCase().includes(params.content!.toLowerCase()))
      : allMessages;
    return {
      messages: filtered.map((m) => [m]),
      totalResults: filtered.length,
    };
  }
}
