import { z } from "zod";
import { getFirebaseAuth } from "@/shared/lib";
import type {
  Channel,
  DeleteMessageData,
  EditMessageData,
  Guild,
  GuildMember,
  Message,
  UserProfile,
} from "@/shared/model/types";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type {
  CreateMyProfileMediaUploadUrlInput,
  ChannelPermissionSnapshot,
  CreateChannelData,
  CreateGuildData,
  CreateModerationMuteData,
  CreateModerationReportData,
  GuildPermissionSnapshot,
  MyProfileMediaDownload,
  MyProfileMediaUpload,
  MessagePage,
  MessageQueryParams,
  MyProfile,
  ModerationMute,
  ModerationReport,
  PermissionSnapshot,
  ProfileMediaTarget,
  Role,
  SendMessageParams,
  UpdateGuildData,
  UpdateMyProfileInput,
} from "./api-client";
import {
  MESSAGE_CREATE_RESPONSE_SCHEMA,
  MESSAGE_LIST_RESPONSE_SCHEMA,
  mapMessageItem,
  mapMessagePage,
  parseMessagePayload,
} from "./message-contract";
import { hasMyProfileUpdateFields } from "./my-profile-validation";
import { NoDataAPIClient } from "./no-data-api-client";

const API_BASE_URL_SCHEMA = z.string().url();
const GUILD_SUMMARY_SCHEMA = z.object({
  guild_id: z.number().int().positive(),
  name: z.string().trim().min(1),
  icon_key: z.string().trim().min(1).nullable().optional(),
  joined_at: z.string().trim().min(1),
});
const GUILD_LIST_RESPONSE_SCHEMA = z.object({
  guilds: z.array(GUILD_SUMMARY_SCHEMA),
});
const GUILD_CREATE_RESPONSE_SCHEMA = z.object({
  guild: z.object({
    guild_id: z.number().int().positive(),
    name: z.string().trim().min(1),
    icon_key: z.string().trim().min(1).nullable().optional(),
    owner_id: z.number().int().positive(),
  }),
});
const GUILD_UPDATE_RESPONSE_SCHEMA = GUILD_CREATE_RESPONSE_SCHEMA;
const CHANNEL_SUMMARY_SCHEMA = z.object({
  channel_id: z.number().int().positive(),
  guild_id: z.number().int().positive(),
  name: z.string().trim().min(1),
  type: z.enum(["guild_text", "guild_category"]).optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  position: z.number().int().nonnegative().optional(),
  created_at: z.string().trim().min(1),
});
const DM_RECIPIENT_SCHEMA = z.object({
  user_id: z.number().int().positive(),
  display_name: z.string().trim().min(1),
  avatar_key: z.string().trim().min(1).nullable().optional(),
});
const DM_CHANNEL_SUMMARY_SCHEMA = z.object({
  channel_id: z.number().int().positive(),
  created_at: z.string().trim().min(1),
  last_message_id: z.number().int().positive().nullable().optional(),
  recipient: DM_RECIPIENT_SCHEMA,
});
const DM_CHANNEL_LIST_RESPONSE_SCHEMA = z.object({
  channels: z.array(DM_CHANNEL_SUMMARY_SCHEMA),
});
const DM_CHANNEL_RESPONSE_SCHEMA = z.object({
  channel: DM_CHANNEL_SUMMARY_SCHEMA,
});
const CHANNEL_LIST_RESPONSE_SCHEMA = z.object({
  channels: z.array(CHANNEL_SUMMARY_SCHEMA),
});
const CHANNEL_CREATE_RESPONSE_SCHEMA = z.object({
  channel: CHANNEL_SUMMARY_SCHEMA,
});
const CHANNEL_PATCH_RESPONSE_SCHEMA = z.object({
  channel: CHANNEL_SUMMARY_SCHEMA,
});
const MODERATION_REPORT_SCHEMA = z.object({
  report_id: z.number().int().positive(),
  guild_id: z.number().int().positive(),
  reporter_id: z.number().int().positive(),
  target_type: z.enum(["message", "user"]),
  target_id: z.number().int().positive(),
  reason: z.string().trim().min(1),
  status: z.enum(["open", "resolved"]),
  resolved_by: z.number().int().positive().nullable().optional(),
  resolved_at: z.string().trim().min(1).nullable().optional(),
  created_at: z.string().trim().min(1),
  updated_at: z.string().trim().min(1),
});
const MODERATION_REPORT_LIST_RESPONSE_SCHEMA = z.object({
  reports: z.array(MODERATION_REPORT_SCHEMA),
});
const MODERATION_REPORT_RESPONSE_SCHEMA = z.object({
  report: MODERATION_REPORT_SCHEMA,
});
const MODERATION_MUTE_SCHEMA = z.object({
  mute_id: z.number().int().positive(),
  guild_id: z.number().int().positive(),
  target_user_id: z.number().int().positive(),
  reason: z.string().trim().min(1),
  created_by: z.number().int().positive(),
  expires_at: z.string().trim().min(1).nullable().optional(),
  created_at: z.string().trim().min(1),
});
const MODERATION_MUTE_RESPONSE_SCHEMA = z.object({
  mute: MODERATION_MUTE_SCHEMA,
});
const MY_PROFILE_SCHEMA = z.object({
  display_name: z.string(),
  status_text: z.string().nullable(),
  avatar_key: z.string().nullable(),
  banner_key: z.string().nullable(),
  theme: z.enum(["dark", "light"]),
});
const MY_PROFILE_RESPONSE_SCHEMA = z.object({
  profile: MY_PROFILE_SCHEMA,
});
const GUILD_MEMBER_SCHEMA = z.object({
  user_id: z.number().int().positive(),
  display_name: z.string().trim().min(1),
  avatar_key: z.string().trim().min(1).nullable().optional(),
  status_text: z.string().trim().min(1).nullable().optional(),
  nickname: z.string().trim().min(1).nullable().optional(),
  joined_at: z.string().trim().min(1),
  role_keys: z.array(z.string().trim().min(1)),
});
const GUILD_MEMBERS_RESPONSE_SCHEMA = z.object({
  members: z.array(GUILD_MEMBER_SCHEMA),
});
const GUILD_ROLE_SCHEMA = z.object({
  role_key: z.string().trim().min(1),
  name: z.string().trim().min(1),
  priority: z.number().int(),
  allow_manage: z.boolean(),
  member_count: z.number().int().nonnegative(),
});
const GUILD_ROLES_RESPONSE_SCHEMA = z.object({
  roles: z.array(GUILD_ROLE_SCHEMA),
});
const USER_PROFILE_RESPONSE_SCHEMA = z.object({
  profile: z.object({
    user_id: z.number().int().positive(),
    display_name: z.string().trim().min(1),
    status_text: z.string().trim().min(1).nullable().optional(),
    avatar_key: z.string().trim().min(1).nullable().optional(),
    banner_key: z.string().trim().min(1).nullable().optional(),
    created_at: z.string().trim().min(1),
  }),
});
const PROFILE_MEDIA_TARGET_SCHEMA = z.enum(["avatar", "banner"]);
const PROFILE_MEDIA_UPLOAD_RESPONSE_SCHEMA = z.object({
  upload: z.object({
    target: PROFILE_MEDIA_TARGET_SCHEMA,
    object_key: z.string().trim().min(1),
    upload_url: z.string().url(),
    expires_at: z.string().trim().min(1),
    method: z.literal("PUT"),
    required_headers: z.record(z.string(), z.string()),
  }),
});
const PROFILE_MEDIA_DOWNLOAD_RESPONSE_SCHEMA = z.object({
  media: z.object({
    target: PROFILE_MEDIA_TARGET_SCHEMA,
    object_key: z.string().trim().min(1),
    download_url: z.string().url(),
    expires_at: z.string().trim().min(1),
  }),
});
const PERMISSION_SNAPSHOT_RESPONSE_SCHEMA = z.object({
  request_id: z.string().trim().min(1),
  snapshot: z.object({
    guild_id: z.number().int().positive(),
    channel_id: z.number().int().positive().nullable(),
    guild: z.object({
      can_view: z.boolean(),
      can_create_channel: z.boolean(),
      can_create_invite: z.boolean(),
      can_manage_settings: z.boolean(),
      can_moderate: z.boolean(),
    }),
    channel: z
      .object({
        can_view: z.boolean(),
        can_post: z.boolean(),
        can_manage: z.boolean(),
      })
      .nullable(),
  }),
});
const BACKEND_ERROR_RESPONSE_SCHEMA = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  request_id: z.string().trim().min(1),
});
const CHANNEL_LOOKUP_BATCH_SIZE = 4;
const CHANNEL_NAME_MAX_CHARS = 100;
const DEFAULT_GUILD_VALUES = {
  banner: null,
  ownerId: "0",
  memberCount: 0,
  boostLevel: 0,
  boostCount: 0,
  features: [] as Guild["features"],
  description: null,
} as const;
const DEFAULT_CHANNEL_VALUES = {
  type: 0,
  topic: null,
  parentId: null,
  nsfw: false,
  rateLimitPerUser: 0,
  lastMessageId: null,
} as const;
const SUPPORTED_CHANNEL_TYPES = [0, 4] as const;
const CATEGORY_CHANNEL_TYPE = 4 as const;
const CREATE_ERROR_MESSAGES = {
  validation: "入力内容を確認してください。",
  userNotFound: "対象ユーザーが見つかりません。",
  authzDenied: "この操作を行う権限がありません。",
  authzUnavailable: "認可サービスが一時的に利用できません。しばらくしてから再試行してください。",
  guildNotFound: "対象のサーバーが見つかりません。",
  authRequired: "ログイン状態を確認してから再試行してください。",
  network: "ネットワーク接続を確認してから再試行してください。",
} as const;
const UPDATE_ERROR_MESSAGES = {
  validation: "入力内容を確認してください。",
  authzDenied: "この操作を行う権限がありません。",
  authzUnavailable: "認可サービスが一時的に利用できません。しばらくしてから再試行してください。",
  channelNotFound: "対象のチャンネルが見つかりません。",
  authRequired: "ログイン状態を確認してから再試行してください。",
  network: "ネットワーク接続を確認してから再試行してください。",
} as const;
const DELETE_ERROR_MESSAGES = {
  validation: "入力内容を確認してください。",
  authzDenied: "この操作を行う権限がありません。",
  authzUnavailable: "認可サービスが一時的に利用できません。しばらくしてから再試行してください。",
  guildNotFound: "対象のサーバーが見つかりません。",
  channelNotFound: "対象のチャンネルが見つかりません。",
  authRequired: "ログイン状態を確認してから再試行してください。",
  network: "ネットワーク接続を確認してから再試行してください。",
} as const;
const MESSAGE_ERROR_MESSAGES = {
  validation: "メッセージ内容を確認してください。",
  authzDenied: "このチャンネルへメッセージを送信する権限がありません。",
  authzUnavailable: "認可サービスが一時的に利用できません。しばらくしてから再試行してください。",
  channelNotFound: "対象のチャンネルが見つかりません。",
  rateLimited: "送信が多すぎます。少し待ってから再試行してください。",
  authRequired: "ログイン状態を確認してから再試行してください。",
  network: "ネットワーク接続を確認してから再試行してください。",
} as const;
const MESSAGE_TIMELINE_ERROR_MESSAGES = {
  authzDenied: "このチャンネルを表示する権限がありません。",
  authzUnavailable: "認可サービスが一時的に利用できません。しばらくしてから再試行してください。",
  channelNotFound: "対象のチャンネルが見つかりません。",
  authRequired: "ログイン状態を確認してから再試行してください。",
  network: "ネットワーク接続を確認してから再試行してください。",
} as const;
const MESSAGE_UPDATE_ERROR_MESSAGES = {
  conflict: "メッセージが更新されています。最新状態を読み直しました。",
} as const;
const MESSAGE_DELETE_ERROR_MESSAGES = {
  conflict: "メッセージの状態が変わっています。最新状態を読み直しました。",
} as const;
const MESSAGE_UPDATE_RESPONSE_SCHEMA = MESSAGE_CREATE_RESPONSE_SCHEMA;
const MESSAGE_DELETE_RESPONSE_SCHEMA = MESSAGE_CREATE_RESPONSE_SCHEMA;

type GuildListResponse = z.infer<typeof GUILD_LIST_RESPONSE_SCHEMA>;
type GuildCreateResponse = z.infer<typeof GUILD_CREATE_RESPONSE_SCHEMA>;
type GuildUpdateResponse = z.infer<typeof GUILD_UPDATE_RESPONSE_SCHEMA>;
type ChannelListResponse = z.infer<typeof CHANNEL_LIST_RESPONSE_SCHEMA>;
type ChannelSummaryResponse = z.infer<typeof CHANNEL_SUMMARY_SCHEMA>;
type DmChannelListResponse = z.infer<typeof DM_CHANNEL_LIST_RESPONSE_SCHEMA>;
type MyProfileResponse = z.infer<typeof MY_PROFILE_RESPONSE_SCHEMA>;
type GuildMembersResponse = z.infer<typeof GUILD_MEMBERS_RESPONSE_SCHEMA>;
type GuildRolesResponse = z.infer<typeof GUILD_ROLES_RESPONSE_SCHEMA>;
type UserProfileResponse = z.infer<typeof USER_PROFILE_RESPONSE_SCHEMA>;
type ProfileMediaUploadResponse = z.infer<typeof PROFILE_MEDIA_UPLOAD_RESPONSE_SCHEMA>;
type ProfileMediaDownloadResponse = z.infer<typeof PROFILE_MEDIA_DOWNLOAD_RESPONSE_SCHEMA>;
type PermissionSnapshotResponse = z.infer<typeof PERMISSION_SNAPSHOT_RESPONSE_SCHEMA>;
type SupportedChannelType = (typeof SUPPORTED_CHANNEL_TYPES)[number];
type ModerationReportApi = z.infer<typeof MODERATION_REPORT_SCHEMA>;
type ModerationMuteApi = z.infer<typeof MODERATION_MUTE_SCHEMA>;

type GuildChannelApiErrorParams = {
  status: number | null;
  code: string | null;
  requestId: string | null;
  retryAfterMs: number | null;
};
type AuthenticatedRequestFailureCode =
  | "unauthenticated"
  | "token-unavailable"
  | "network-request-failed";
type AuthenticatedRequestResult =
  | {
      ok: true;
      response: Response;
    }
  | {
      ok: false;
      error: {
        code: AuthenticatedRequestFailureCode;
        message: string;
      };
    };

/**
 * guild/channel API 呼び出しの失敗を表現する。
 */
export class GuildChannelApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly requestId: string | null;
  readonly retryAfterMs: number | null;

  constructor(message: string, params: Partial<GuildChannelApiErrorParams> = {}) {
    super(message);
    this.name = "GuildChannelApiError";
    this.status = params.status ?? null;
    this.code = params.code ?? null;
    this.requestId = params.requestId ?? null;
    this.retryAfterMs = params.retryAfterMs ?? null;
  }
}

/**
 * guild/channel API失敗情報を画面表示用テキストに変換する。
 */
export function toApiErrorText(error: unknown, fallbackMessage: string): string {
  if (error instanceof GuildChannelApiError) {
    if (error.requestId === null) {
      return error.message;
    }
    return `${error.message} (request_id: ${error.requestId})`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function attachRequestId(message: string, requestId: string | null): string {
  if (requestId === null) {
    return message;
  }
  return `${message} (request_id: ${requestId})`;
}

/**
 * 作成系API失敗をユーザー向けメッセージへ変換する。
 */
export function toCreateActionErrorText(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof GuildChannelApiError)) {
    return toApiErrorText(error, fallbackMessage);
  }

  if (error.code === "VALIDATION_ERROR") {
    return attachRequestId(CREATE_ERROR_MESSAGES.validation, error.requestId);
  }
  if (error.code === "USER_NOT_FOUND") {
    return attachRequestId(CREATE_ERROR_MESSAGES.userNotFound, error.requestId);
  }
  if (error.code === "AUTHZ_DENIED") {
    return attachRequestId(CREATE_ERROR_MESSAGES.authzDenied, error.requestId);
  }
  if (error.code === "AUTHZ_UNAVAILABLE") {
    return attachRequestId(CREATE_ERROR_MESSAGES.authzUnavailable, error.requestId);
  }
  if (error.code === "GUILD_NOT_FOUND") {
    return attachRequestId(CREATE_ERROR_MESSAGES.guildNotFound, error.requestId);
  }
  if (error.code === "unauthenticated" || error.code === "token-unavailable") {
    return attachRequestId(CREATE_ERROR_MESSAGES.authRequired, error.requestId);
  }
  if (error.code === "network-request-failed") {
    return attachRequestId(CREATE_ERROR_MESSAGES.network, error.requestId);
  }

  return attachRequestId(fallbackMessage, error.requestId);
}

/**
 * 更新系API失敗をユーザー向けメッセージへ変換する。
 */
export function toUpdateActionErrorText(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof GuildChannelApiError)) {
    return toApiErrorText(error, fallbackMessage);
  }

  if (error.code === "VALIDATION_ERROR") {
    return attachRequestId(UPDATE_ERROR_MESSAGES.validation, error.requestId);
  }
  if (error.code === "AUTHZ_DENIED") {
    return attachRequestId(UPDATE_ERROR_MESSAGES.authzDenied, error.requestId);
  }
  if (error.code === "AUTHZ_UNAVAILABLE") {
    return attachRequestId(UPDATE_ERROR_MESSAGES.authzUnavailable, error.requestId);
  }
  if (error.code === "MESSAGE_CONFLICT" || error.status === 409) {
    return attachRequestId(MESSAGE_UPDATE_ERROR_MESSAGES.conflict, error.requestId);
  }
  if (error.code === "CHANNEL_NOT_FOUND") {
    return attachRequestId(UPDATE_ERROR_MESSAGES.channelNotFound, error.requestId);
  }
  if (error.code === "unauthenticated" || error.code === "token-unavailable") {
    return attachRequestId(UPDATE_ERROR_MESSAGES.authRequired, error.requestId);
  }
  if (error.code === "network-request-failed") {
    return attachRequestId(UPDATE_ERROR_MESSAGES.network, error.requestId);
  }

  return attachRequestId(fallbackMessage, error.requestId);
}

/**
 * 削除系API失敗をユーザー向けメッセージへ変換する。
 */
export function toDeleteActionErrorText(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof GuildChannelApiError)) {
    return toApiErrorText(error, fallbackMessage);
  }

  if (error.code === "AUTHZ_DENIED") {
    return attachRequestId(DELETE_ERROR_MESSAGES.authzDenied, error.requestId);
  }
  if (error.code === "VALIDATION_ERROR") {
    return attachRequestId(DELETE_ERROR_MESSAGES.validation, error.requestId);
  }
  if (error.code === "AUTHZ_UNAVAILABLE") {
    return attachRequestId(DELETE_ERROR_MESSAGES.authzUnavailable, error.requestId);
  }
  if (error.code === "MESSAGE_CONFLICT" || error.status === 409) {
    return attachRequestId(MESSAGE_DELETE_ERROR_MESSAGES.conflict, error.requestId);
  }
  if (error.code === "GUILD_NOT_FOUND") {
    return attachRequestId(DELETE_ERROR_MESSAGES.guildNotFound, error.requestId);
  }
  if (error.code === "CHANNEL_NOT_FOUND") {
    return attachRequestId(DELETE_ERROR_MESSAGES.channelNotFound, error.requestId);
  }
  if (error.code === "unauthenticated" || error.code === "token-unavailable") {
    return attachRequestId(DELETE_ERROR_MESSAGES.authRequired, error.requestId);
  }
  if (error.code === "network-request-failed") {
    return attachRequestId(DELETE_ERROR_MESSAGES.network, error.requestId);
  }

  return attachRequestId(fallbackMessage, error.requestId);
}

/**
 * message create/list API失敗を composer 向け文言へ変換する。
 */
export function toMessageActionErrorText(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof GuildChannelApiError)) {
    return toApiErrorText(error, fallbackMessage);
  }

  if (error.code === "VALIDATION_ERROR") {
    return attachRequestId(MESSAGE_ERROR_MESSAGES.validation, error.requestId);
  }
  if (error.code === "AUTHZ_DENIED") {
    return attachRequestId(MESSAGE_ERROR_MESSAGES.authzDenied, error.requestId);
  }
  if (error.code === "AUTHZ_UNAVAILABLE") {
    return attachRequestId(MESSAGE_ERROR_MESSAGES.authzUnavailable, error.requestId);
  }
  if (error.code === "CHANNEL_NOT_FOUND") {
    return attachRequestId(MESSAGE_ERROR_MESSAGES.channelNotFound, error.requestId);
  }
  if (error.code === "RATE_LIMITED" || error.status === 429) {
    const retryAfterSeconds =
      error.retryAfterMs === null ? null : Math.max(1, Math.ceil(error.retryAfterMs / 1_000));
    const retryAfterSuffix =
      retryAfterSeconds === null ? "" : `（約 ${retryAfterSeconds} 秒後に再試行してください）`;
    return attachRequestId(
      `${MESSAGE_ERROR_MESSAGES.rateLimited}${retryAfterSuffix}`,
      error.requestId,
    );
  }
  if (error.code === "unauthenticated" || error.code === "token-unavailable") {
    return attachRequestId(MESSAGE_ERROR_MESSAGES.authRequired, error.requestId);
  }
  if (error.code === "network-request-failed") {
    return attachRequestId(MESSAGE_ERROR_MESSAGES.network, error.requestId);
  }

  return attachRequestId(fallbackMessage, error.requestId);
}

/**
 * message timeline fetch 失敗をユーザー向けメッセージへ変換する。
 */
export function toMessageTimelineErrorText(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof GuildChannelApiError)) {
    return toApiErrorText(error, fallbackMessage);
  }

  if (error.code === "AUTHZ_DENIED") {
    return attachRequestId(MESSAGE_TIMELINE_ERROR_MESSAGES.authzDenied, error.requestId);
  }
  if (error.code === "AUTHZ_UNAVAILABLE") {
    return attachRequestId(MESSAGE_TIMELINE_ERROR_MESSAGES.authzUnavailable, error.requestId);
  }
  if (error.code === "CHANNEL_NOT_FOUND") {
    return attachRequestId(MESSAGE_TIMELINE_ERROR_MESSAGES.channelNotFound, error.requestId);
  }
  if (error.code === "unauthenticated" || error.code === "token-unavailable") {
    return attachRequestId(MESSAGE_TIMELINE_ERROR_MESSAGES.authRequired, error.requestId);
  }
  if (error.code === "network-request-failed") {
    return attachRequestId(MESSAGE_TIMELINE_ERROR_MESSAGES.network, error.requestId);
  }

  return attachRequestId(fallbackMessage, error.requestId);
}

function resolveApiBaseUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new GuildChannelApiError("NEXT_PUBLIC_API_URL is required but not set.", {
      code: "CONFIG_INVALID",
    });
  }

  const parsed = API_BASE_URL_SCHEMA.safeParse(rawUrl);
  if (!parsed.success) {
    const reason = parsed.error.issues.map((issue) => issue.message).join(", ");
    throw new GuildChannelApiError(`NEXT_PUBLIC_API_URL is invalid: ${reason}`, {
      code: "CONFIG_INVALID",
    });
  }

  return parsed.data.replace(/\/+$/, "");
}

function parseRetryAfterMs(response: Response): number | null {
  const retryAfterRaw = response.headers.get("retry-after");
  if (retryAfterRaw === null) {
    return null;
  }

  const retryAfterSeconds = Number(retryAfterRaw);
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0) {
    return null;
  }

  return Math.round(retryAfterSeconds * 1000);
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `message-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function authenticatedRequest(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<AuthenticatedRequestResult> {
  const currentUser = getFirebaseAuth().currentUser;
  if (currentUser === null) {
    return {
      ok: false,
      error: {
        code: "unauthenticated",
        message: "ログイン中のユーザーが見つかりません。",
      },
    };
  }

  let idToken: string;
  try {
    idToken = await currentUser.getIdToken();
  } catch {
    return {
      ok: false,
      error: {
        code: "token-unavailable",
        message: "IDトークンの取得に失敗しました。",
      },
    };
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${idToken}`);

  try {
    const response = await fetch(input, {
      ...init,
      headers,
    });

    return {
      ok: true,
      response,
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "network-request-failed",
        message: "認証APIへの接続に失敗しました。",
      },
    };
  }
}

function mapGuild(summary: GuildListResponse["guilds"][number]): Guild {
  return {
    id: String(summary.guild_id),
    name: summary.name,
    icon: summary.icon_key ?? null,
    ...DEFAULT_GUILD_VALUES,
  };
}

function mapCreatedGuild(summary: GuildCreateResponse["guild"]): Guild {
  return {
    ...DEFAULT_GUILD_VALUES,
    id: String(summary.guild_id),
    name: summary.name,
    icon: summary.icon_key ?? null,
    ownerId: String(summary.owner_id),
  };
}

function mapChannel(summary: ChannelListResponse["channels"][number], position: number): Channel {
  return {
    ...DEFAULT_CHANNEL_VALUES,
    id: String(summary.channel_id),
    type: summary.type === "guild_category" ? CATEGORY_CHANNEL_TYPE : 0,
    guildId: String(summary.guild_id),
    name: summary.name,
    position: summary.position ?? position,
    parentId: summary.parent_id == null ? null : String(summary.parent_id),
  };
}

function mapDmRecipient(
  recipient: DmChannelListResponse["channels"][number]["recipient"],
): NonNullable<Channel["recipients"]>[number] {
  return {
    id: String(recipient.user_id),
    username: recipient.display_name,
    displayName: recipient.display_name,
    avatar: recipient.avatar_key ?? null,
    status: "offline",
    customStatus: null,
    bot: false,
  };
}

function mapDmChannel(
  summary: DmChannelListResponse["channels"][number],
  position: number,
): Channel {
  return {
    ...DEFAULT_CHANNEL_VALUES,
    id: String(summary.channel_id),
    type: 1,
    name: summary.recipient.display_name,
    position,
    recipients: [mapDmRecipient(summary.recipient)],
    lastMessageId:
      summary.last_message_id == null
        ? DEFAULT_CHANNEL_VALUES.lastMessageId
        : String(summary.last_message_id),
  };
}

function mapMyProfile(response: MyProfileResponse): MyProfile {
  return {
    displayName: response.profile.display_name,
    statusText: response.profile.status_text,
    avatarKey: response.profile.avatar_key,
    bannerKey: response.profile.banner_key,
    theme: response.profile.theme,
  };
}

function mapGuildMember(entry: GuildMembersResponse["members"][number]): GuildMember {
  const statusText = entry.status_text ?? null;

  return {
    user: {
      id: String(entry.user_id),
      username: entry.display_name,
      displayName: entry.display_name,
      avatar: null,
      status: "offline",
      customStatus: statusText,
      bot: false,
    },
    nick: entry.nickname ?? null,
    roles: entry.role_keys,
    joinedAt: entry.joined_at,
    avatar: null,
  };
}

function mapRole(entry: GuildRolesResponse["roles"][number]): Role {
  return {
    id: entry.role_key,
    name: entry.name,
    color: "#99aab5",
    position: entry.priority,
    permissions: entry.allow_manage ? 1 : 0,
    mentionable: false,
    hoist: entry.priority > 100,
    memberCount: entry.member_count,
  };
}

function mapUserProfile(response: UserProfileResponse): UserProfile {
  const statusText = response.profile.status_text ?? null;

  return {
    id: String(response.profile.user_id),
    username: response.profile.display_name,
    displayName: response.profile.display_name,
    avatar: null,
    status: "offline",
    customStatus: statusText,
    bot: false,
    banner: null,
    bio: statusText,
    accentColor: null,
    badges: [],
    createdAt: response.profile.created_at,
  };
}

function mapProfileMediaUpload(response: ProfileMediaUploadResponse): MyProfileMediaUpload {
  return {
    target: response.upload.target,
    objectKey: response.upload.object_key,
    uploadUrl: response.upload.upload_url,
    expiresAt: response.upload.expires_at,
    method: response.upload.method,
    requiredHeaders: response.upload.required_headers,
  };
}

function mapProfileMediaDownload(response: ProfileMediaDownloadResponse): MyProfileMediaDownload {
  return {
    target: response.media.target,
    objectKey: response.media.object_key,
    downloadUrl: response.media.download_url,
    expiresAt: response.media.expires_at,
  };
}

function mapGuildPermissionSnapshot(
  snapshot: PermissionSnapshotResponse["snapshot"]["guild"],
): GuildPermissionSnapshot {
  return {
    canView: snapshot.can_view,
    canCreateChannel: snapshot.can_create_channel,
    canCreateInvite: snapshot.can_create_invite,
    canManageSettings: snapshot.can_manage_settings,
    canModerate: snapshot.can_moderate,
  };
}

function mapChannelPermissionSnapshot(
  snapshot: PermissionSnapshotResponse["snapshot"]["channel"],
): ChannelPermissionSnapshot | null {
  if (snapshot === null) {
    return null;
  }

  return {
    canView: snapshot.can_view,
    canPost: snapshot.can_post,
    canManage: snapshot.can_manage,
  };
}

function mapPermissionSnapshot(response: PermissionSnapshotResponse): PermissionSnapshot {
  return {
    guildId: String(response.snapshot.guild_id),
    channelId: response.snapshot.channel_id === null ? null : String(response.snapshot.channel_id),
    guild: mapGuildPermissionSnapshot(response.snapshot.guild),
    channel: mapChannelPermissionSnapshot(response.snapshot.channel),
  };
}

function isSupportedChannelType(type: CreateChannelData["type"]): type is SupportedChannelType {
  return SUPPORTED_CHANNEL_TYPES.some((supportedType) => supportedType === type);
}

function mapModerationReport(report: ModerationReportApi): ModerationReport {
  return {
    reportId: String(report.report_id),
    guildId: String(report.guild_id),
    reporterId: String(report.reporter_id),
    targetType: report.target_type,
    targetId: String(report.target_id),
    reason: report.reason,
    status: report.status,
    resolvedBy: report.resolved_by == null ? null : String(report.resolved_by),
    resolvedAt: report.resolved_at ?? null,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  };
}

function mapModerationMute(mute: ModerationMuteApi): ModerationMute {
  return {
    muteId: String(mute.mute_id),
    guildId: String(mute.guild_id),
    targetUserId: String(mute.target_user_id),
    reason: mute.reason,
    createdBy: String(mute.created_by),
    expiresAt: mute.expires_at ?? null,
    createdAt: mute.created_at,
  };
}

/**
 * guild/channel 一覧導線だけを実APIへ接続したAPIクライアント。
 */
export class GuildChannelAPIClient extends NoDataAPIClient {
  private apiBaseUrl: string | null = null;
  private readonly channelCacheByGuild = new Map<string, Channel[]>();
  private readonly channelIndex = new Map<string, Channel>();
  private dmChannelsCache: Channel[] | null = null;

  private getApiBaseUrl(): string {
    if (this.apiBaseUrl === null) {
      this.apiBaseUrl = resolveApiBaseUrl();
    }
    return this.apiBaseUrl;
  }

  private buildUrl(path: string): string {
    return `${this.getApiBaseUrl()}${path}`;
  }

  private async parseErrorResponse(response: Response): Promise<GuildChannelApiError> {
    const retryAfterMs = parseRetryAfterMs(response);
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      return new GuildChannelApiError(`Request failed with status ${response.status}.`, {
        status: response.status,
        code: "HTTP_ERROR",
        retryAfterMs,
      });
    }

    const parsed = BACKEND_ERROR_RESPONSE_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return new GuildChannelApiError(`Request failed with status ${response.status}.`, {
        status: response.status,
        code: "HTTP_ERROR",
        retryAfterMs,
      });
    }

    return new GuildChannelApiError(parsed.data.message, {
      status: response.status,
      code: parsed.data.code,
      requestId: parsed.data.request_id,
      retryAfterMs,
    });
  }

  private async requestJson<T>(params: {
    path: string;
    method: "GET" | "POST" | "PATCH" | "DELETE";
    schema: z.ZodType<T>;
    expectedStatus: number;
    body?: Record<string, unknown>;
    extraHeaders?: HeadersInit;
    parseResponseText?: (rawText: string) => unknown;
  }): Promise<T> {
    const headers = new Headers();
    if (params.extraHeaders !== undefined) {
      new Headers(params.extraHeaders).forEach((value, key) => {
        headers.set(key, value);
      });
    }
    let body: string | undefined;
    if (params.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(params.body);
    }

    const fetchResult = await authenticatedRequest(this.buildUrl(params.path), {
      method: params.method,
      headers,
      body,
    });
    if (!fetchResult.ok) {
      throw new GuildChannelApiError(fetchResult.error.message, {
        code: fetchResult.error.code,
      });
    }

    const { response } = fetchResult;
    if (!response.ok) {
      throw await this.parseErrorResponse(response);
    }
    if (response.status !== params.expectedStatus) {
      throw new GuildChannelApiError(`Request failed with status ${response.status}.`, {
        status: response.status,
        code: "UNEXPECTED_RESPONSE",
      });
    }

    let rawText: string;
    try {
      rawText = await response.text();
    } catch {
      throw new GuildChannelApiError("API response is not valid JSON.", {
        status: response.status,
        code: "UNEXPECTED_RESPONSE",
      });
    }

    let payload: unknown = null;
    try {
      payload =
        params.parseResponseText === undefined
          ? JSON.parse(rawText)
          : params.parseResponseText(rawText);
    } catch {
      throw new GuildChannelApiError("API response is not valid JSON.", {
        status: response.status,
        code: "UNEXPECTED_RESPONSE",
      });
    }

    const parsed = params.schema.safeParse(payload);
    if (!parsed.success) {
      throw new GuildChannelApiError("API response schema validation failed.", {
        status: response.status,
        code: "UNEXPECTED_RESPONSE",
      });
    }

    return parsed.data;
  }

  private async getJson<T>(
    path: string,
    schema: z.ZodType<T>,
    options?: { parseResponseText?: (rawText: string) => unknown },
  ): Promise<T> {
    return this.requestJson({
      path,
      method: "GET",
      schema,
      expectedStatus: 200,
      parseResponseText: options?.parseResponseText,
    });
  }

  private async postJson<T>(
    path: string,
    body: Record<string, unknown>,
    schema: z.ZodType<T>,
    options?: {
      extraHeaders?: HeadersInit;
      parseResponseText?: (rawText: string) => unknown;
    },
  ): Promise<T> {
    return this.requestJson({
      path,
      method: "POST",
      body,
      schema,
      expectedStatus: 201,
      extraHeaders: options?.extraHeaders,
      parseResponseText: options?.parseResponseText,
    });
  }

  private async patchJson<T>(
    path: string,
    body: Record<string, unknown>,
    schema: z.ZodType<T>,
    options?: { parseResponseText?: (rawText: string) => unknown },
  ): Promise<T> {
    return this.requestJson({
      path,
      method: "PATCH",
      body,
      schema,
      expectedStatus: 200,
      parseResponseText: options?.parseResponseText,
    });
  }

  private async deleteJson<T>(
    path: string,
    body: Record<string, unknown>,
    schema: z.ZodType<T>,
    options?: { parseResponseText?: (rawText: string) => unknown },
  ): Promise<T> {
    return this.requestJson({
      path,
      method: "DELETE",
      body,
      schema,
      expectedStatus: 200,
      parseResponseText: options?.parseResponseText,
    });
  }

  private async deleteNoContent(path: string): Promise<void> {
    const fetchResult = await authenticatedRequest(this.buildUrl(path), {
      method: "DELETE",
      headers: new Headers(),
    });
    if (!fetchResult.ok) {
      throw new GuildChannelApiError(fetchResult.error.message, {
        code: fetchResult.error.code,
      });
    }

    const { response } = fetchResult;
    if (!response.ok) {
      throw await this.parseErrorResponse(response);
    }
    if (response.status !== 204) {
      throw new GuildChannelApiError(`Request failed with status ${response.status}.`, {
        status: response.status,
        code: "UNEXPECTED_RESPONSE",
      });
    }
  }
  private buildUpdatedChannel(
    summary: ChannelSummaryResponse,
    current: Channel | undefined,
    fallbackPosition: number,
  ): Channel {
    if (current !== undefined) {
      return {
        ...current,
        ...mapChannel(summary, fallbackPosition),
      };
    }

    return mapChannel(summary, fallbackPosition);
  }

  private collectDeletedChannelIds(channelId: string, guildId: string | undefined): Set<string> {
    const deletedIds = new Set<string>([channelId]);
    if (guildId === undefined) {
      return deletedIds;
    }

    const cachedChannels = this.channelCacheByGuild.get(guildId);
    if (cachedChannels === undefined) {
      return deletedIds;
    }

    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const channel of cachedChannels) {
        if (
          channel.parentId !== null &&
          deletedIds.has(channel.parentId) &&
          !deletedIds.has(channel.id)
        ) {
          deletedIds.add(channel.id);
          foundChild = true;
        }
      }
    }

    return deletedIds;
  }

  private removeChannelsFromGuildCache(channelIds: Set<string>, guildId: string | undefined): void {
    for (const channelId of channelIds) {
      this.channelIndex.delete(channelId);
    }

    if (guildId !== undefined) {
      const cachedChannels = this.channelCacheByGuild.get(guildId);
      if (cachedChannels !== undefined) {
        this.channelCacheByGuild.set(
          guildId,
          cachedChannels.filter((channel) => !channelIds.has(channel.id)),
        );
      }
      return;
    }

    for (const [cachedGuildId, cachedChannels] of this.channelCacheByGuild.entries()) {
      const nextChannels = cachedChannels.filter((channel) => !channelIds.has(channel.id));
      if (nextChannels.length !== cachedChannels.length) {
        this.channelCacheByGuild.set(cachedGuildId, nextChannels);
      }
    }
  }

  private upsertChannelInGuildCache(channel: Channel): void {
    const guildId = channel.guildId;
    if (guildId === undefined) {
      return;
    }

    const cachedChannels = this.channelCacheByGuild.get(guildId);
    if (cachedChannels === undefined) {
      return;
    }

    const index = cachedChannels.findIndex((candidate) => candidate.id === channel.id);
    if (index < 0) {
      this.channelCacheByGuild.set(guildId, [...cachedChannels, channel]);
      return;
    }

    const nextChannels = [...cachedChannels];
    nextChannels[index] = channel;
    this.channelCacheByGuild.set(guildId, nextChannels);
  }

  private removeChannelFromGuildCache(channelId: string, guildId: string | undefined): void {
    this.channelIndex.delete(channelId);

    if (guildId !== undefined) {
      const cachedChannels = this.channelCacheByGuild.get(guildId);
      if (cachedChannels !== undefined) {
        this.channelCacheByGuild.set(
          guildId,
          cachedChannels.filter((channel) => channel.id !== channelId),
        );
      }
      return;
    }

    for (const [cachedGuildId, cachedChannels] of this.channelCacheByGuild.entries()) {
      const nextChannels = cachedChannels.filter((channel) => channel.id !== channelId);
      if (nextChannels.length !== cachedChannels.length) {
        this.channelCacheByGuild.set(cachedGuildId, nextChannels);
        return;
      }
    }
  }

  private removeGuildFromCache(serverId: string): void {
    this.channelCacheByGuild.delete(serverId);

    for (const [channelId, channel] of this.channelIndex.entries()) {
      if (channel.guildId === serverId) {
        this.channelIndex.delete(channelId);
      }
    }
  }

  private upsertDmChannel(channel: Channel): void {
    this.channelIndex.set(channel.id, channel);
    if (this.dmChannelsCache === null) {
      this.dmChannelsCache = [channel];
      return;
    }

    const index = this.dmChannelsCache.findIndex((candidate) => candidate.id === channel.id);
    if (index < 0) {
      this.dmChannelsCache = [...this.dmChannelsCache, channel];
      return;
    }

    const nextChannels = [...this.dmChannelsCache];
    nextChannels[index] = channel;
    this.dmChannelsCache = nextChannels;
  }

  private async fetchDmChannels(): Promise<Channel[]> {
    const response = await this.getJson("/users/me/dms", DM_CHANNEL_LIST_RESPONSE_SCHEMA);
    const channels = response.channels.map((channel, position) => mapDmChannel(channel, position));
    this.dmChannelsCache = channels;
    for (const channel of channels) {
      this.channelIndex.set(channel.id, channel);
    }
    return channels;
  }

  private async fetchDmChannel(channelId: string): Promise<Channel> {
    const response = await this.getJson(
      `/v1/dms/${encodeURIComponent(channelId)}`,
      DM_CHANNEL_RESPONSE_SCHEMA,
    );
    const position = this.dmChannelsCache?.findIndex((channel) => channel.id === channelId) ?? 0;
    const channel = mapDmChannel(response.channel, position < 0 ? 0 : position);
    this.upsertDmChannel(channel);
    return channel;
  }

  private async fetchGuilds(options: { resetChannelCache: boolean }): Promise<Guild[]> {
    const response = await this.getJson("/guilds", GUILD_LIST_RESPONSE_SCHEMA);
    const guilds = response.guilds.map(mapGuild);

    if (options.resetChannelCache) {
      this.channelCacheByGuild.clear();
      this.dmChannelsCache = null;
      this.channelIndex.clear();
    }

    return guilds;
  }

  async getServers(): Promise<Guild[]> {
    return this.fetchGuilds({ resetChannelCache: true });
  }

  async getServer(serverId: string): Promise<Guild> {
    const normalizedServerId = serverId.trim();
    if (normalizedServerId.length === 0) {
      throw new GuildChannelApiError("Server not found.", {
        status: 404,
        code: "GUILD_NOT_FOUND",
      });
    }

    const servers = await this.fetchGuilds({ resetChannelCache: false });
    const server = servers.find((candidate) => candidate.id === normalizedServerId);
    if (!server) {
      throw new GuildChannelApiError("Server not found.", {
        status: 404,
        code: "GUILD_NOT_FOUND",
      });
    }

    return server;
  }

  async getPermissionSnapshot(
    serverId: string,
    params?: { channelId?: string | null },
  ): Promise<PermissionSnapshot> {
    const normalizedServerId = serverId.trim();
    if (normalizedServerId.length === 0) {
      throw new GuildChannelApiError("Server not found.", {
        status: 404,
        code: "GUILD_NOT_FOUND",
      });
    }

    const normalizedChannelId = params?.channelId?.trim() ?? "";
    const searchParams = new URLSearchParams();
    if (normalizedChannelId.length > 0) {
      searchParams.set("channel_id", normalizedChannelId);
    }

    const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
    const response = await this.getJson(
      `/guilds/${encodeURIComponent(normalizedServerId)}/permission-snapshot${suffix}`,
      PERMISSION_SNAPSHOT_RESPONSE_SCHEMA,
    );
    return mapPermissionSnapshot(response);
  }

  private async fetchChannelsForServer(serverId: string): Promise<Channel[]> {
    const response = await this.getJson(
      `/guilds/${encodeURIComponent(serverId)}/channels`,
      CHANNEL_LIST_RESPONSE_SCHEMA,
    );
    const channels = response.channels.map((channel, position) => mapChannel(channel, position));
    const cached = this.channelCacheByGuild.get(serverId);

    if (cached !== undefined) {
      for (const channel of cached) {
        this.channelIndex.delete(channel.id);
      }
    }

    this.channelCacheByGuild.set(serverId, channels);
    for (const channel of channels) {
      this.channelIndex.set(channel.id, channel);
    }

    return channels;
  }

  async getChannels(serverId: string): Promise<Channel[]> {
    const normalizedServerId = serverId.trim();
    if (normalizedServerId.length === 0) {
      return [];
    }

    const cached = this.channelCacheByGuild.get(normalizedServerId);
    if (cached !== undefined) {
      return cached;
    }

    return this.fetchChannelsForServer(normalizedServerId);
  }

  async getChannel(channelId: string): Promise<Channel> {
    const normalizedChannelId = channelId.trim();
    if (normalizedChannelId.length === 0) {
      throw new GuildChannelApiError("Channel not found.", {
        status: 404,
        code: "CHANNEL_NOT_FOUND",
      });
    }

    const indexed = this.channelIndex.get(normalizedChannelId);
    if (indexed !== undefined) {
      return indexed;
    }

    const servers = await this.fetchGuilds({ resetChannelCache: false });
    const serverIds = servers.map((server) => server.id);
    const uncachedServerIds = serverIds.filter(
      (serverId) => this.channelCacheByGuild.has(serverId) === false,
    );
    const cachedServerIds = serverIds.filter((serverId) => this.channelCacheByGuild.has(serverId));

    let firstFetchError: unknown = null;
    let fetchedAnyChannelList = false;

    for (let index = 0; index < uncachedServerIds.length; index += CHANNEL_LOOKUP_BATCH_SIZE) {
      const batchServerIds = uncachedServerIds.slice(index, index + CHANNEL_LOOKUP_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batchServerIds.map((serverId) => this.fetchChannelsForServer(serverId)),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          fetchedAnyChannelList = true;
          continue;
        }

        if (firstFetchError === null) {
          firstFetchError = result.reason;
        }
      }

      const foundInBatch = this.channelIndex.get(normalizedChannelId);
      if (foundInBatch !== undefined) {
        return foundInBatch;
      }
    }

    for (let index = 0; index < cachedServerIds.length; index += CHANNEL_LOOKUP_BATCH_SIZE) {
      const batchServerIds = cachedServerIds.slice(index, index + CHANNEL_LOOKUP_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batchServerIds.map((serverId) => this.fetchChannelsForServer(serverId)),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          fetchedAnyChannelList = true;
          continue;
        }

        if (firstFetchError === null) {
          firstFetchError = result.reason;
        }
      }

      const foundInBatch = this.channelIndex.get(normalizedChannelId);
      if (foundInBatch !== undefined) {
        return foundInBatch;
      }
    }

    const refreshed = this.channelIndex.get(normalizedChannelId);
    if (refreshed !== undefined) {
      return refreshed;
    }

    if (this.dmChannelsCache === null) {
      try {
        const channels = await this.fetchDmChannels();
        const dmChannel = channels.find((channel) => channel.id === normalizedChannelId);
        if (dmChannel !== undefined) {
          return dmChannel;
        }
      } catch {
        // Fall through to DM detail lookup.
      }
    }

    try {
      return await this.fetchDmChannel(normalizedChannelId);
    } catch (error) {
      if (
        error instanceof GuildChannelApiError &&
        error.code !== "CHANNEL_NOT_FOUND" &&
        error.status !== 404
      ) {
        throw error;
      }
    }

    if (!fetchedAnyChannelList && firstFetchError !== null) {
      if (firstFetchError instanceof Error) {
        throw firstFetchError;
      }
      throw new GuildChannelApiError("Failed to fetch channels while looking up target channel.", {
        code: "CHANNEL_LOOKUP_FAILED",
      });
    }

    throw new GuildChannelApiError("Channel not found.", {
      status: 404,
      code: "CHANNEL_NOT_FOUND",
    });
  }

  async getMessages(params: MessageQueryParams): Promise<MessagePage> {
    const normalizedGuildId = params.guildId?.trim() ?? "";
    const normalizedChannelId = params.channelId.trim();
    if (normalizedChannelId.length === 0) {
      throw new GuildChannelApiError(MESSAGE_ERROR_MESSAGES.channelNotFound, {
        status: 404,
        code: "CHANNEL_NOT_FOUND",
      });
    }

    const searchParams = new URLSearchParams();
    if (params.before !== undefined && params.before.trim().length > 0) {
      searchParams.set("before", params.before.trim());
    }
    if (params.after !== undefined && params.after.trim().length > 0) {
      searchParams.set("after", params.after.trim());
    }
    if (params.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }

    const suffix = searchParams.size === 0 ? "" : `?${searchParams.toString()}`;
    const path =
      normalizedGuildId.length > 0
        ? `/v1/guilds/${encodeURIComponent(normalizedGuildId)}/channels/${encodeURIComponent(
            normalizedChannelId,
          )}/messages${suffix}`
        : `/v1/dms/${encodeURIComponent(normalizedChannelId)}/messages${suffix}`;
    const response = await this.getJson(path, MESSAGE_LIST_RESPONSE_SCHEMA, {
      parseResponseText: parseMessagePayload,
    });

    return mapMessagePage(response);
  }

  async sendMessage(params: SendMessageParams): Promise<Message> {
    const normalizedGuildId = params.guildId?.trim() ?? "";
    const normalizedChannelId = params.channelId.trim();
    const normalizedContent = params.data.content.trim();
    if (normalizedChannelId.length === 0 || normalizedContent.length === 0) {
      throw new GuildChannelApiError(MESSAGE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const path =
      normalizedGuildId.length > 0
        ? `/v1/guilds/${encodeURIComponent(normalizedGuildId)}/channels/${encodeURIComponent(
            normalizedChannelId,
          )}/messages`
        : `/v1/dms/${encodeURIComponent(normalizedChannelId)}/messages`;
    const response = await this.postJson(
      path,
      { content: normalizedContent },
      MESSAGE_CREATE_RESPONSE_SCHEMA,
      {
        extraHeaders: {
          "Idempotency-Key": createIdempotencyKey(),
        },
        parseResponseText: parseMessagePayload,
      },
    );

    const createdMessage = mapMessageItem(response.message);
    const currentUser = useAuthStore.getState().currentUser;
    if (currentUser === null) {
      return createdMessage;
    }

    const currentPrincipalId = useAuthStore.getState().currentPrincipalId;

    return {
      ...createdMessage,
      author:
        currentPrincipalId !== null && currentUser.id !== currentPrincipalId
          ? {
              ...currentUser,
              id: currentPrincipalId,
            }
          : currentUser,
    };
  }

  async editMessage(channelId: string, messageId: string, data: EditMessageData): Promise<Message> {
    const normalizedChannelId = channelId.trim();
    const normalizedMessageId = messageId.trim();
    const normalizedContent = data.content.trim();
    const expectedVersion = data.expectedVersion.trim();
    if (
      normalizedChannelId.length === 0 ||
      normalizedMessageId.length === 0 ||
      normalizedContent.length === 0 ||
      expectedVersion.length === 0
    ) {
      throw new GuildChannelApiError(UPDATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const channel = await this.getChannel(normalizedChannelId);
    const response = await this.patchJson(
      `/v1/guilds/${encodeURIComponent(channel.guildId ?? "")}/channels/${encodeURIComponent(
        normalizedChannelId,
      )}/messages/${encodeURIComponent(normalizedMessageId)}`,
      {
        content: normalizedContent,
        expected_version: Number(expectedVersion),
      },
      MESSAGE_UPDATE_RESPONSE_SCHEMA,
      {
        parseResponseText: parseMessagePayload,
      },
    );

    return mapMessageItem(response.message);
  }

  async deleteMessage(
    channelId: string,
    messageId: string,
    data: DeleteMessageData,
  ): Promise<Message> {
    const normalizedChannelId = channelId.trim();
    const normalizedMessageId = messageId.trim();
    const expectedVersion = data.expectedVersion.trim();
    if (
      normalizedChannelId.length === 0 ||
      normalizedMessageId.length === 0 ||
      expectedVersion.length === 0
    ) {
      throw new GuildChannelApiError(DELETE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const channel = await this.getChannel(normalizedChannelId);
    const response = await this.deleteJson(
      `/v1/guilds/${encodeURIComponent(channel.guildId ?? "")}/channels/${encodeURIComponent(
        normalizedChannelId,
      )}/messages/${encodeURIComponent(normalizedMessageId)}`,
      {
        expected_version: Number(expectedVersion),
      },
      MESSAGE_DELETE_RESPONSE_SCHEMA,
      { parseResponseText: parseMessagePayload },
    );

    return mapMessageItem(response.message);
  }

  async getMembers(serverId: string): Promise<GuildMember[]> {
    const normalizedServerId = serverId.trim();
    if (normalizedServerId.length === 0) {
      return [];
    }

    const response = await this.getJson(
      `/v1/guilds/${encodeURIComponent(normalizedServerId)}/members`,
      GUILD_MEMBERS_RESPONSE_SCHEMA,
    );

    return response.members.map(mapGuildMember);
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    const normalizedUserId = userId.trim();
    if (normalizedUserId.length === 0) {
      throw new GuildChannelApiError("User ID is required.", {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const response = await this.getJson(
      `/v1/users/${encodeURIComponent(normalizedUserId)}/profile`,
      USER_PROFILE_RESPONSE_SCHEMA,
    );

    return mapUserProfile(response);
  }

  async getRoles(serverId: string): Promise<Role[]> {
    const normalizedServerId = serverId.trim();
    if (normalizedServerId.length === 0) {
      return [];
    }

    const response = await this.getJson(
      `/v1/guilds/${encodeURIComponent(normalizedServerId)}/roles`,
      GUILD_ROLES_RESPONSE_SCHEMA,
    );

    return response.roles.map(mapRole);
  }

  /**
   * ピン留め一覧は未接続のため空配列を返す。
   */
  getPinnedMessages(_channelId: string): Promise<Message[]> {
    return Promise.resolve([]);
  }

  /**
   * リアクション追加は v1 では未接続として扱う。
   */
  addReaction(_channelId: string, _messageId: string, _emoji: string): Promise<void> {
    return Promise.reject(
      new GuildChannelApiError("リアクション追加は v1 では未接続です。", {
        status: 501,
        code: "FEATURE_UNAVAILABLE",
      }),
    );
  }

  /**
   * リアクション解除は v1 では未接続として扱う。
   */
  removeReaction(_channelId: string, _messageId: string, _emoji: string): Promise<void> {
    return Promise.reject(
      new GuildChannelApiError("リアクション解除は v1 では未接続です。", {
        status: 501,
        code: "FEATURE_UNAVAILABLE",
      }),
    );
  }

  /**
   * ピン留めは v1 では未接続として扱う。
   */
  pinMessage(_channelId: string, _messageId: string): Promise<void> {
    return Promise.reject(
      new GuildChannelApiError("ピン留め操作は v1 では未接続です。", {
        status: 501,
        code: "FEATURE_UNAVAILABLE",
      }),
    );
  }

  /**
   * ピン留め解除は v1 では未接続として扱う。
   */
  unpinMessage(_channelId: string, _messageId: string): Promise<void> {
    return Promise.reject(
      new GuildChannelApiError("ピン留め操作は v1 では未接続です。", {
        status: 501,
        code: "FEATURE_UNAVAILABLE",
      }),
    );
  }

  async getMyProfile(): Promise<MyProfile> {
    const response = await this.getJson("/users/me/profile", MY_PROFILE_RESPONSE_SCHEMA);
    return mapMyProfile(response);
  }

  async updateMyProfile(input: UpdateMyProfileInput): Promise<MyProfile> {
    if (!hasMyProfileUpdateFields(input)) {
      throw new GuildChannelApiError("No profile fields provided.", {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const body: Record<string, unknown> = {};
    if (input.displayName !== undefined) {
      body.display_name = input.displayName;
    }
    if (input.statusText !== undefined) {
      body.status_text = input.statusText;
    }
    if (input.avatarKey !== undefined) {
      body.avatar_key = input.avatarKey;
    }
    if (input.bannerKey !== undefined) {
      body.banner_key = input.bannerKey;
    }
    if (input.theme !== undefined) {
      body.theme = input.theme;
    }

    const response = await this.patchJson("/users/me/profile", body, MY_PROFILE_RESPONSE_SCHEMA);
    return mapMyProfile(response);
  }

  async createMyProfileMediaUploadUrl(
    input: CreateMyProfileMediaUploadUrlInput,
  ): Promise<MyProfileMediaUpload> {
    const response = await this.requestJson({
      path: "/users/me/profile/media/upload-url",
      method: "POST",
      body: {
        target: input.target,
        filename: input.filename,
        content_type: input.contentType,
      },
      schema: PROFILE_MEDIA_UPLOAD_RESPONSE_SCHEMA,
      expectedStatus: 200,
    });
    return mapProfileMediaUpload(response);
  }

  async getMyProfileMediaDownloadUrl(target: ProfileMediaTarget): Promise<MyProfileMediaDownload> {
    const response = await this.getJson(
      `/users/me/profile/media/${target}/download-url`,
      PROFILE_MEDIA_DOWNLOAD_RESPONSE_SCHEMA,
    );
    return mapProfileMediaDownload(response);
  }

  async createServer(data: CreateGuildData): Promise<Guild> {
    const normalizedName = data.name.trim();
    if (normalizedName.length === 0) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const response = await this.postJson(
      "/guilds",
      { name: normalizedName },
      GUILD_CREATE_RESPONSE_SCHEMA,
    );
    return mapCreatedGuild(response.guild);
  }

  async updateServer(serverId: string, data: UpdateGuildData): Promise<Guild> {
    const normalizedServerId = serverId.trim();
    if (normalizedServerId.length === 0) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.guildNotFound, {
        status: 404,
        code: "GUILD_NOT_FOUND",
      });
    }

    const body: Record<string, unknown> = {};
    if (data.name !== undefined) {
      const normalizedName = data.name.trim();
      if (normalizedName.length === 0 || normalizedName.length > 100) {
        throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
          status: 400,
          code: "VALIDATION_ERROR",
        });
      }
      body.name = normalizedName;
    }
    if (data.icon !== undefined) {
      if (data.icon === null) {
        body.icon_key = null;
      } else {
        const normalizedIcon = data.icon.trim();
        body.icon_key = normalizedIcon.length > 0 ? normalizedIcon : null;
      }
    }
    if (Object.keys(body).length === 0) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const response = await this.patchJson(
      `/guilds/${encodeURIComponent(normalizedServerId)}`,
      body,
      GUILD_UPDATE_RESPONSE_SCHEMA,
    );
    return mapUpdatedGuild(response);
  }

  async deleteServer(serverId: string): Promise<void> {
    const normalizedServerId = serverId.trim();
    if (normalizedServerId.length === 0) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.guildNotFound, {
        status: 404,
        code: "GUILD_NOT_FOUND",
      });
    }

    await this.deleteNoContent(`/guilds/${encodeURIComponent(normalizedServerId)}`);
    this.removeGuildFromCache(normalizedServerId);
  }

  async createChannel(serverId: string, data: CreateChannelData): Promise<Channel> {
    const normalizedServerId = serverId.trim();
    if (normalizedServerId.length === 0) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.guildNotFound, {
        status: 404,
        code: "GUILD_NOT_FOUND",
      });
    }

    if (!isSupportedChannelType(data.type)) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const normalizedName = data.name.trim();
    if (normalizedName.length === 0) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const normalizedParentId = data.parentId?.trim() ?? "";
    if (data.type === CATEGORY_CHANNEL_TYPE && normalizedParentId.length > 0) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    let parsedParentId: number | null = null;
    if (normalizedParentId.length > 0) {
      parsedParentId = Number.parseInt(normalizedParentId, 10);
      if (!Number.isInteger(parsedParentId) || parsedParentId <= 0) {
        throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
          status: 400,
          code: "VALIDATION_ERROR",
        });
      }
    }

    const body: Record<string, unknown> = { name: normalizedName };
    if (data.type === CATEGORY_CHANNEL_TYPE) {
      body.type = "guild_category";
    } else if (parsedParentId !== null) {
      body.type = "guild_text";
      body.parent_id = parsedParentId;
    }

    const response = await this.postJson(
      `/guilds/${encodeURIComponent(normalizedServerId)}/channels`,
      body,
      CHANNEL_CREATE_RESPONSE_SCHEMA,
    );
    const cachedChannels = this.channelCacheByGuild.get(normalizedServerId);
    const nextPosition = cachedChannels?.length ?? 0;
    const channel = mapChannel(response.channel, nextPosition);

    if (cachedChannels !== undefined) {
      this.channelCacheByGuild.set(normalizedServerId, [...cachedChannels, channel]);
    }
    this.channelIndex.set(channel.id, channel);

    return channel;
  }

  async getDMChannels(): Promise<Channel[]> {
    if (this.dmChannelsCache !== null) {
      return this.dmChannelsCache;
    }
    return this.fetchDmChannels();
  }

  async createDM(recipientId: string): Promise<Channel> {
    const normalizedRecipientId = recipientId.trim();
    const recipientNumber = Number(normalizedRecipientId);
    if (
      normalizedRecipientId.length === 0 ||
      !Number.isSafeInteger(recipientNumber) ||
      recipientNumber <= 0
    ) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const response = await this.postJson(
      "/users/me/dms",
      { recipient_id: recipientNumber },
      DM_CHANNEL_RESPONSE_SCHEMA,
    );
    const channel = mapDmChannel(
      response.channel,
      this.dmChannelsCache?.findIndex(
        (candidate) => candidate.id === String(response.channel.channel_id),
      ) ??
        this.dmChannelsCache?.length ??
        0,
    );
    this.upsertDmChannel(channel);
    return channel;
  }

  async getModerationReports(serverId: string): Promise<ModerationReport[]> {
    const normalizedServerId = serverId.trim();
    if (normalizedServerId.length === 0) {
      return [];
    }

    const response = await this.getJson(
      `/guilds/${encodeURIComponent(normalizedServerId)}/moderation/reports`,
      MODERATION_REPORT_LIST_RESPONSE_SCHEMA,
    );
    return response.reports.map(mapModerationReport);
  }

  async getModerationReport(serverId: string, reportId: string): Promise<ModerationReport> {
    const normalizedServerId = serverId.trim();
    const normalizedReportId = reportId.trim();
    if (normalizedServerId.length === 0 || normalizedReportId.length === 0) {
      throw new GuildChannelApiError("Moderation report not found.", {
        status: 404,
        code: "MODERATION_NOT_FOUND",
      });
    }

    const response = await this.getJson(
      `/guilds/${encodeURIComponent(normalizedServerId)}/moderation/reports/${encodeURIComponent(
        normalizedReportId,
      )}`,
      MODERATION_REPORT_RESPONSE_SCHEMA,
    );

    return mapModerationReport(response.report);
  }

  async createModerationReport(
    serverId: string,
    data: CreateModerationReportData,
  ): Promise<ModerationReport> {
    const normalizedServerId = serverId.trim();
    const normalizedReason = data.reason.trim();
    const normalizedTargetId = data.targetId.trim();
    if (
      normalizedServerId.length === 0 ||
      normalizedReason.length === 0 ||
      normalizedTargetId.length === 0
    ) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const targetIdNumber = Number.parseInt(normalizedTargetId, 10);
    if (!Number.isInteger(targetIdNumber) || targetIdNumber <= 0) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const response = await this.requestJson({
      path: `/guilds/${encodeURIComponent(normalizedServerId)}/moderation/reports`,
      method: "POST",
      expectedStatus: 201,
      body: {
        target_type: data.targetType,
        target_id: targetIdNumber,
        reason: normalizedReason,
      },
      schema: MODERATION_REPORT_RESPONSE_SCHEMA,
    });

    return mapModerationReport(response.report);
  }

  async resolveModerationReport(serverId: string, reportId: string): Promise<ModerationReport> {
    const normalizedServerId = serverId.trim();
    const normalizedReportId = reportId.trim();
    const response = await this.requestJson({
      path: `/guilds/${encodeURIComponent(normalizedServerId)}/moderation/reports/${encodeURIComponent(
        normalizedReportId,
      )}/resolve`,
      method: "POST",
      expectedStatus: 200,
      schema: MODERATION_REPORT_RESPONSE_SCHEMA,
    });
    return mapModerationReport(response.report);
  }

  async reopenModerationReport(serverId: string, reportId: string): Promise<ModerationReport> {
    const normalizedServerId = serverId.trim();
    const normalizedReportId = reportId.trim();
    const response = await this.requestJson({
      path: `/guilds/${encodeURIComponent(normalizedServerId)}/moderation/reports/${encodeURIComponent(
        normalizedReportId,
      )}/reopen`,
      method: "POST",
      expectedStatus: 200,
      schema: MODERATION_REPORT_RESPONSE_SCHEMA,
    });
    return mapModerationReport(response.report);
  }

  async createModerationMute(
    serverId: string,
    data: CreateModerationMuteData,
  ): Promise<ModerationMute> {
    const normalizedServerId = serverId.trim();
    const normalizedTargetUserId = data.targetUserId.trim();
    const normalizedReason = data.reason.trim();
    if (
      normalizedServerId.length === 0 ||
      normalizedTargetUserId.length === 0 ||
      normalizedReason.length === 0
    ) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const targetUserIdNumber = Number.parseInt(normalizedTargetUserId, 10);
    if (!Number.isInteger(targetUserIdNumber) || targetUserIdNumber <= 0) {
      throw new GuildChannelApiError(CREATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const response = await this.requestJson({
      path: `/guilds/${encodeURIComponent(normalizedServerId)}/moderation/mutes`,
      method: "POST",
      expectedStatus: 201,
      body: {
        target_user_id: targetUserIdNumber,
        reason: normalizedReason,
        expires_at: data.expiresAt ?? null,
      },
      schema: MODERATION_MUTE_RESPONSE_SCHEMA,
    });

    return mapModerationMute(response.mute);
  }

  async updateChannel(channelId: string, data: Partial<Channel>): Promise<Channel> {
    const normalizedChannelId = channelId.trim();
    if (normalizedChannelId.length === 0) {
      throw new GuildChannelApiError(UPDATE_ERROR_MESSAGES.channelNotFound, {
        status: 404,
        code: "CHANNEL_NOT_FOUND",
      });
    }

    if (typeof data.name !== "string") {
      throw new GuildChannelApiError(UPDATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const normalizedName = data.name.trim();
    if (normalizedName.length === 0 || normalizedName.length > CHANNEL_NAME_MAX_CHARS) {
      throw new GuildChannelApiError(UPDATE_ERROR_MESSAGES.validation, {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const response = await this.patchJson(
      `/channels/${encodeURIComponent(normalizedChannelId)}`,
      { name: normalizedName },
      CHANNEL_PATCH_RESPONSE_SCHEMA,
    );
    const guildId = String(response.channel.guild_id);
    const cachedChannels = this.channelCacheByGuild.get(guildId);
    const indexed = this.channelIndex.get(normalizedChannelId);
    const cached = cachedChannels?.find((channel) => channel.id === normalizedChannelId);
    const current = indexed ?? cached;
    const fallbackPosition = current?.position ?? cachedChannels?.length ?? 0;
    const updatedChannel = this.buildUpdatedChannel(response.channel, current, fallbackPosition);

    this.channelIndex.set(updatedChannel.id, updatedChannel);
    this.upsertChannelInGuildCache(updatedChannel);

    return updatedChannel;
  }

  async deleteChannel(channelId: string): Promise<void> {
    const normalizedChannelId = channelId.trim();
    if (normalizedChannelId.length === 0) {
      throw new GuildChannelApiError(UPDATE_ERROR_MESSAGES.channelNotFound, {
        status: 404,
        code: "CHANNEL_NOT_FOUND",
      });
    }

    const indexedChannel = this.channelIndex.get(normalizedChannelId);
    const deletedIds = this.collectDeletedChannelIds(normalizedChannelId, indexedChannel?.guildId);
    await this.deleteNoContent(`/channels/${encodeURIComponent(normalizedChannelId)}`);
    this.removeChannelsFromGuildCache(deletedIds, indexedChannel?.guildId);
  }
}

function mapUpdatedGuild(response: GuildUpdateResponse): Guild {
  return mapCreatedGuild(response.guild);
}
