import { z } from "zod";
import { getFirebaseAuth } from "@/shared/lib";
import type { Channel, Guild } from "@/shared/model/types";
import type { CreateChannelData, CreateGuildData } from "./api-client";
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
const CHANNEL_SUMMARY_SCHEMA = z.object({
  channel_id: z.number().int().positive(),
  guild_id: z.number().int().positive(),
  name: z.string().trim().min(1),
  created_at: z.string().trim().min(1),
});
const CHANNEL_LIST_RESPONSE_SCHEMA = z.object({
  channels: z.array(CHANNEL_SUMMARY_SCHEMA),
});
const CHANNEL_CREATE_RESPONSE_SCHEMA = z.object({
  channel: CHANNEL_SUMMARY_SCHEMA,
});
const BACKEND_ERROR_RESPONSE_SCHEMA = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  request_id: z.string().trim().min(1),
});
const CHANNEL_LOOKUP_BATCH_SIZE = 4;
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
const SUPPORTED_CHANNEL_TYPES = [0] as const;
const CREATE_ERROR_MESSAGES = {
  validation: "入力内容を確認してください。",
  authzDenied: "この操作を行う権限がありません。",
  authzUnavailable: "認可サービスが一時的に利用できません。しばらくしてから再試行してください。",
  guildNotFound: "対象のサーバーが見つかりません。",
  authRequired: "ログイン状態を確認してから再試行してください。",
  network: "ネットワーク接続を確認してから再試行してください。",
} as const;

type GuildListResponse = z.infer<typeof GUILD_LIST_RESPONSE_SCHEMA>;
type GuildCreateResponse = z.infer<typeof GUILD_CREATE_RESPONSE_SCHEMA>;
type ChannelListResponse = z.infer<typeof CHANNEL_LIST_RESPONSE_SCHEMA>;
type SupportedChannelType = (typeof SUPPORTED_CHANNEL_TYPES)[number];

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
    id: String(summary.channel_id),
    guildId: String(summary.guild_id),
    name: summary.name,
    position,
    ...DEFAULT_CHANNEL_VALUES,
  };
}

function isSupportedChannelType(type: CreateChannelData["type"]): type is SupportedChannelType {
  return SUPPORTED_CHANNEL_TYPES.some((supportedType) => supportedType === type);
}

/**
 * guild/channel 一覧導線だけを実APIへ接続したAPIクライアント。
 */
export class GuildChannelAPIClient extends NoDataAPIClient {
  private apiBaseUrl: string | null = null;
  private readonly channelCacheByGuild = new Map<string, Channel[]>();
  private readonly channelIndex = new Map<string, Channel>();

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
    method: "GET" | "POST";
    schema: z.ZodType<T>;
    expectedStatus: number;
    body?: Record<string, unknown>;
  }): Promise<T> {
    const headers = new Headers();
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

    let payload: unknown = null;
    try {
      payload = await response.json();
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

  private async getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    return this.requestJson({
      path,
      method: "GET",
      schema,
      expectedStatus: 200,
    });
  }

  private async postJson<T>(
    path: string,
    body: Record<string, unknown>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    return this.requestJson({
      path,
      method: "POST",
      body,
      schema,
      expectedStatus: 201,
    });
  }

  private async fetchGuilds(options: { resetChannelCache: boolean }): Promise<Guild[]> {
    const response = await this.getJson("/guilds", GUILD_LIST_RESPONSE_SCHEMA);
    const guilds = response.guilds.map(mapGuild);

    if (options.resetChannelCache) {
      this.channelCacheByGuild.clear();
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

    const response = await this.postJson(
      `/guilds/${encodeURIComponent(normalizedServerId)}/channels`,
      { name: normalizedName },
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
}
