import { useAuthStore } from "@/shared/model/stores/auth-store";
import { useSettingsStore } from "@/shared/model/stores/settings-store";
import type {
  APIClient,
  AuditLogEntry,
  MessagePage,
  MessageQueryParams,
  SendMessageParams,
  PermissionSnapshot,
  CreateMyProfileMediaUploadUrlInput,
  CreateModerationMuteData,
  CreateModerationReportData,
  CreateChannelData,
  CreateGuildData,
  MyProfileMediaDownload,
  MyProfileMediaUpload,
  UpdateGuildData,
  CreateInviteData,
  Invite,
  ModerationMute,
  ModerationReport,
  MyProfile,
  Relationship,
  Role,
  SearchParams,
  SearchResult,
  UpdateMyProfileInput,
  Webhook,
} from "./api-client";
import { createMyProfileValidationError, hasMyProfileUpdateFields } from "./my-profile-validation";
import type {
  Channel,
  Guild,
  GuildMember,
  Message,
  User,
  UserProfile,
  CreateMessageData,
  EditMessageData,
  DeleteMessageData,
} from "@/shared/model/types";

function unsupported(action: string): Error {
  return new Error(`API action '${action}' is not available in no-data mode.`);
}

function unsupportedPromise<T>(action: string): Promise<T> {
  return Promise.reject(unsupported(action));
}

function resolveCurrentUser(): User | null {
  return useAuthStore.getState().currentUser;
}

function resolveCurrentUserOrThrow(): User {
  const user = resolveCurrentUser();
  if (user === null) {
    throw unsupported("authentication");
  }
  return user;
}

function buildProfile(user: User): UserProfile {
  return {
    ...user,
    banner: null,
    bio: null,
    accentColor: null,
    badges: [],
    createdAt: new Date(0).toISOString(),
  };
}

function buildMyProfile(user: User): MyProfile {
  return {
    displayName: user.displayName,
    statusText: user.customStatus,
    avatarKey: null,
    bannerKey: null,
    theme: useSettingsStore.getState().theme,
  };
}

/**
 * モックデータを使用しない空データAPIクライアント。
 */
export class NoDataAPIClient implements APIClient {
  getCurrentUser(): Promise<User> {
    try {
      return Promise.resolve(resolveCurrentUserOrThrow());
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error("Unknown authentication error."),
      );
    }
  }

  getServers(): Promise<Guild[]> {
    return Promise.resolve([]);
  }

  getServer(_serverId: string): Promise<Guild> {
    return unsupportedPromise("getServer");
  }

  createServer(_data: CreateGuildData): Promise<Guild> {
    return unsupportedPromise("createServer");
  }

  updateServer(_serverId: string, _data: UpdateGuildData): Promise<Guild> {
    return unsupportedPromise("updateServer");
  }

  deleteServer(_serverId: string): Promise<void> {
    return unsupportedPromise("deleteServer");
  }

  leaveServer(_serverId: string): Promise<void> {
    return unsupportedPromise("leaveServer");
  }

  getChannels(_serverId: string): Promise<Channel[]> {
    return Promise.resolve([]);
  }

  getChannel(_channelId: string): Promise<Channel> {
    return unsupportedPromise("getChannel");
  }

  createChannel(_serverId: string, _data: CreateChannelData): Promise<Channel> {
    return unsupportedPromise("createChannel");
  }

  updateChannel(_channelId: string, _data: Partial<Channel>): Promise<Channel> {
    return unsupportedPromise("updateChannel");
  }

  deleteChannel(_channelId: string): Promise<void> {
    return unsupportedPromise("deleteChannel");
  }

  getMessages(_params: MessageQueryParams): Promise<MessagePage> {
    return Promise.resolve({
      items: [],
      nextBefore: null,
      nextAfter: null,
      hasMore: false,
    });
  }

  getMessage(_channelId: string, _messageId: string): Promise<Message> {
    return unsupportedPromise("getMessage");
  }

  sendMessage(_params: SendMessageParams): Promise<Message> {
    return unsupportedPromise("sendMessage");
  }

  editMessage(_channelId: string, _messageId: string, _data: EditMessageData): Promise<Message> {
    return unsupportedPromise("editMessage");
  }

  deleteMessage(
    _channelId: string,
    _messageId: string,
    _data: DeleteMessageData,
  ): Promise<Message> {
    return unsupportedPromise("deleteMessage");
  }

  getPinnedMessages(_channelId: string): Promise<Message[]> {
    return Promise.resolve([]);
  }

  addReaction(_channelId: string, _messageId: string, _emoji: string): Promise<void> {
    return unsupportedPromise("addReaction");
  }

  removeReaction(_channelId: string, _messageId: string, _emoji: string): Promise<void> {
    return unsupportedPromise("removeReaction");
  }

  getMembers(
    _serverId: string,
    _params?: { limit?: number; after?: string },
  ): Promise<GuildMember[]> {
    return Promise.resolve([]);
  }

  getMember(_serverId: string, _userId: string): Promise<GuildMember> {
    return unsupportedPromise("getMember");
  }

  getUser(userId: string): Promise<User> {
    const currentUser = resolveCurrentUser();
    const currentPrincipalId = useAuthStore.getState().currentPrincipalId;
    if (currentUser !== null && (currentUser.id === userId || currentPrincipalId === userId)) {
      return Promise.resolve(currentUser);
    }
    return unsupportedPromise("getUser");
  }

  getUserProfile(userId: string): Promise<UserProfile> {
    return this.getUser(userId).then((user) => buildProfile(user));
  }

  getMyProfile(): Promise<MyProfile> {
    try {
      return Promise.resolve(buildMyProfile(resolveCurrentUserOrThrow()));
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error("Unknown profile fetch error."),
      );
    }
  }

  updateMyProfile(input: UpdateMyProfileInput): Promise<MyProfile> {
    if (!hasMyProfileUpdateFields(input)) {
      return Promise.reject(createMyProfileValidationError());
    }

    try {
      const currentUser = resolveCurrentUserOrThrow();
      const displayName =
        input.displayName !== undefined ? input.displayName.trim() : currentUser.displayName;
      const statusText =
        input.statusText !== undefined
          ? (input.statusText?.trim() ?? null)
          : currentUser.customStatus;
      const theme = input.theme ?? useSettingsStore.getState().theme;

      const updatedUser: User = {
        ...currentUser,
        displayName,
        customStatus: statusText,
      };
      useAuthStore.setState({ currentUser: updatedUser, customStatus: statusText });
      useSettingsStore.getState().setTheme(theme);

      return Promise.resolve({
        displayName,
        statusText,
        avatarKey: input.avatarKey ?? null,
        bannerKey: input.bannerKey ?? null,
        theme,
      });
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error("Unknown profile update error."),
      );
    }
  }

  getFriends(): Promise<Relationship[]> {
    return Promise.resolve([]);
  }

  sendFriendRequest(_username: string): Promise<void> {
    return unsupportedPromise("sendFriendRequest");
  }

  acceptFriendRequest(_userId: string): Promise<void> {
    return unsupportedPromise("acceptFriendRequest");
  }

  removeFriend(_userId: string): Promise<void> {
    return unsupportedPromise("removeFriend");
  }

  blockUser(_userId: string): Promise<void> {
    return unsupportedPromise("blockUser");
  }

  getDMChannels(): Promise<Channel[]> {
    return Promise.resolve([]);
  }

  createDM(_recipientId: string): Promise<Channel> {
    return unsupportedPromise("createDM");
  }

  createMyProfileMediaUploadUrl(
    _input: CreateMyProfileMediaUploadUrlInput,
  ): Promise<MyProfileMediaUpload> {
    return unsupportedPromise("createMyProfileMediaUploadUrl");
  }

  getMyProfileMediaDownloadUrl(_target: "avatar" | "banner"): Promise<MyProfileMediaDownload> {
    return unsupportedPromise("getMyProfileMediaDownloadUrl");
  }

  createGroupDM(_recipientIds: string[]): Promise<Channel> {
    return unsupportedPromise("createGroupDM");
  }

  createInvite(_serverId: string, _channelId: string, _data: CreateInviteData): Promise<Invite> {
    return unsupportedPromise("createInvite");
  }

  getInvites(_serverId: string): Promise<Invite[]> {
    return Promise.resolve([]);
  }

  revokeInvite(_inviteCode: string): Promise<void> {
    return unsupportedPromise("revokeInvite");
  }

  getRoles(_serverId: string): Promise<Role[]> {
    return Promise.resolve([]);
  }

  createRole(
    _serverId: string,
    _data: { name: string; color?: string; permissions?: number },
  ): Promise<Role> {
    return unsupportedPromise("createRole");
  }

  updateRole(_serverId: string, _roleId: string, _data: Partial<Role>): Promise<Role> {
    return unsupportedPromise("updateRole");
  }

  deleteRole(_serverId: string, _roleId: string): Promise<void> {
    return unsupportedPromise("deleteRole");
  }

  reorderRoles(_serverId: string, _roles: { id: string; position: number }[]): Promise<void> {
    return unsupportedPromise("reorderRoles");
  }

  getWebhooks(_channelId: string): Promise<Webhook[]> {
    return Promise.resolve([]);
  }

  createWebhook(_channelId: string, _data: { name: string; avatar?: string }): Promise<Webhook> {
    return unsupportedPromise("createWebhook");
  }

  deleteWebhook(_webhookId: string): Promise<void> {
    return unsupportedPromise("deleteWebhook");
  }

  getAuditLog(
    _serverId: string,
    _params?: { before?: string; limit?: number },
  ): Promise<AuditLogEntry[]> {
    return Promise.resolve([]);
  }

  pinMessage(_channelId: string, _messageId: string): Promise<void> {
    return unsupportedPromise("pinMessage");
  }

  unpinMessage(_channelId: string, _messageId: string): Promise<void> {
    return unsupportedPromise("unpinMessage");
  }

  kickMember(_serverId: string, _userId: string): Promise<void> {
    return unsupportedPromise("kickMember");
  }

  banMember(
    _serverId: string,
    _userId: string,
    _data?: { deleteMessageDays?: number },
  ): Promise<void> {
    return unsupportedPromise("banMember");
  }

  timeoutMember(_serverId: string, _userId: string, _until: string | null): Promise<void> {
    return unsupportedPromise("timeoutMember");
  }

  updateMemberNickname(_serverId: string, _userId: string, _nickname: string): Promise<void> {
    return unsupportedPromise("updateMemberNickname");
  }

  getModerationReports(_serverId: string): Promise<ModerationReport[]> {
    return Promise.resolve([]);
  }

  getModerationReport(_serverId: string, _reportId: string): Promise<ModerationReport> {
    return unsupportedPromise("getModerationReport");
  }

  createModerationReport(
    _serverId: string,
    _data: CreateModerationReportData,
  ): Promise<ModerationReport> {
    return unsupportedPromise("createModerationReport");
  }

  resolveModerationReport(_serverId: string, _reportId: string): Promise<ModerationReport> {
    return unsupportedPromise("resolveModerationReport");
  }

  reopenModerationReport(_serverId: string, _reportId: string): Promise<ModerationReport> {
    return unsupportedPromise("reopenModerationReport");
  }

  createModerationMute(
    _serverId: string,
    _data: CreateModerationMuteData,
  ): Promise<ModerationMute> {
    return unsupportedPromise("createModerationMute");
  }

  getPermissionSnapshot(
    _serverId: string,
    _params?: { channelId?: string | null },
  ): Promise<PermissionSnapshot> {
    return unsupportedPromise("getPermissionSnapshot");
  }

  triggerTyping(_channelId: string): Promise<void> {
    return Promise.resolve();
  }

  searchMessages(_serverId: string, _params: SearchParams): Promise<SearchResult> {
    return Promise.resolve({ messages: [], totalResults: 0 });
  }
}
