import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getFirebaseAuthMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib", () => ({
  getFirebaseAuth: getFirebaseAuthMock,
}));

import {
  GuildChannelAPIClient,
  GuildChannelApiError,
  toDeleteActionErrorText,
  toUpdateActionErrorText,
} from "./guild-channel-api-client";

function setApiBaseUrl(url: string): void {
  process.env.NEXT_PUBLIC_API_URL = url;
}

describe("GuildChannelAPIClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getFirebaseAuthMock.mockReset();
    getFirebaseAuthMock.mockReturnValue({
      currentUser: {
        getIdToken: vi.fn().mockResolvedValue("token-1"),
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    setApiBaseUrl("http://localhost:8080");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("getServers maps guild list response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          guilds: [
            {
              guild_id: 2001,
              name: "LinkLynx Developers",
              icon_key: null,
              joined_at: "2026-03-03T00:00:00Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const servers = await client.getServers();

    expect(servers).toEqual([
      {
        id: "2001",
        name: "LinkLynx Developers",
        icon: null,
        banner: null,
        ownerId: "0",
        memberCount: 0,
        boostLevel: 0,
        boostCount: 0,
        features: [],
        description: null,
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/guilds");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
  });

  test("getChannels maps channel list response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          channels: [
            {
              channel_id: 3001,
              guild_id: 2001,
              type: "guild_text",
              name: "general",
              parent_id: null,
              position: 7,
              created_at: "2026-03-03T00:00:00Z",
            },
            {
              channel_id: 3002,
              guild_id: 2001,
              type: "guild_category",
              name: "times",
              parent_id: null,
              position: 3,
              created_at: "2026-03-03T00:00:10Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const channels = await client.getChannels("2001");

    expect(channels).toEqual([
      {
        id: "3001",
        type: 0,
        guildId: "2001",
        name: "general",
        topic: null,
        position: 7,
        parentId: null,
        nsfw: false,
        rateLimitPerUser: 0,
        lastMessageId: null,
      },
      {
        id: "3002",
        type: 4,
        guildId: "2001",
        name: "times",
        topic: null,
        position: 3,
        parentId: null,
        nsfw: false,
        rateLimitPerUser: 0,
        lastMessageId: null,
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/guilds/2001/channels");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
  });

  test("getChannel resolves by scanning guild/channel lists", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            guilds: [
              {
                guild_id: 2001,
                name: "LinkLynx Developers",
                icon_key: null,
                joined_at: "2026-03-03T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channels: [
              {
                channel_id: 3001,
                guild_id: 2001,
                name: "general",
                created_at: "2026-03-03T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const client = new GuildChannelAPIClient();
    const channel = await client.getChannel("3001");

    expect(channel.id).toBe("3001");
    expect(channel.guildId).toBe("2001");
  });

  test("getChannel ignores partial guild fetch failure when another guild has the channel", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            guilds: [
              {
                guild_id: 2001,
                name: "Guild One",
                icon_key: null,
                joined_at: "2026-03-03T00:00:00Z",
              },
              {
                guild_id: 2002,
                name: "Guild Two",
                icon_key: null,
                joined_at: "2026-03-03T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "AUTHZ_DENIED",
            message: "access is denied by authorization policy",
            request_id: "req-g1",
          }),
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channels: [
              {
                channel_id: 3002,
                guild_id: 2002,
                name: "general",
                created_at: "2026-03-03T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const client = new GuildChannelAPIClient();
    const channel = await client.getChannel("3002");

    expect(channel.id).toBe("3002");
    expect(channel.guildId).toBe("2002");
  });

  test("getChannel refreshes cached guild channels when target is not in cache", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channels: [
              {
                channel_id: 3001,
                guild_id: 2001,
                name: "general",
                created_at: "2026-03-03T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            guilds: [
              {
                guild_id: 2001,
                name: "Guild One",
                icon_key: null,
                joined_at: "2026-03-03T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channels: [
              {
                channel_id: 3002,
                guild_id: 2001,
                name: "announcements",
                created_at: "2026-03-03T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const client = new GuildChannelAPIClient();
    await client.getChannels("2001");
    const channel = await client.getChannel("3002");

    expect(channel.id).toBe("3002");
    expect(channel.guildId).toBe("2001");
  });

  test("createServer maps created guild response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          guild: {
            guild_id: 2010,
            name: "New Guild",
            icon_key: null,
            owner_id: 1001,
          },
        }),
        { status: 201 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const created = await client.createServer({ name: "  New Guild  " });

    expect(created).toEqual({
      id: "2010",
      name: "New Guild",
      icon: null,
      banner: null,
      ownerId: "1001",
      memberCount: 0,
      boostLevel: 0,
      boostCount: 0,
      features: [],
      description: null,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/guilds");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "New Guild" }));
  });

  test("updateServer sends patch request and maps updated guild response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          guild: {
            guild_id: 2001,
            name: "Renamed Guild",
            icon_key: "icons/new.png",
            owner_id: 1001,
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const updated = await client.updateServer("2001", { name: "  Renamed Guild  " });

    expect(updated).toEqual({
      id: "2001",
      name: "Renamed Guild",
      icon: "icons/new.png",
      banner: null,
      ownerId: "1001",
      memberCount: 0,
      boostLevel: 0,
      boostCount: 0,
      features: [],
      description: null,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/guilds/2001");
    expect(init.method).toBe("PATCH");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "Renamed Guild" }));
  });

  test("updateServer rejects too long name before network call", async () => {
    const client = new GuildChannelAPIClient();
    const tooLongName = "a".repeat(101);

    await expect(client.updateServer("2001", { name: tooLongName })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("deleteServer sends delete request and clears cached guild channels", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channels: [
              {
                channel_id: 3001,
                guild_id: 2001,
                name: "general",
                created_at: "2026-03-03T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channels: [],
          }),
          { status: 200 },
        ),
      );

    const client = new GuildChannelAPIClient();
    expect(await client.getChannels("2001")).toHaveLength(1);

    await client.deleteServer("2001");
    expect(await client.getChannels("2001")).toEqual([]);

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/guilds/2001");
    expect(init.method).toBe("DELETE");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("createChannel maps created channel response and updates channel index", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          channel: {
            channel_id: 3010,
            guild_id: 2001,
            type: "guild_text",
            name: "release",
            parent_id: null,
            position: 2,
            created_at: "2026-03-03T00:00:00Z",
          },
        }),
        { status: 201 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const created = await client.createChannel("2001", { name: "release", type: 0 });
    const resolved = await client.getChannel(created.id);

    expect(created.id).toBe("3010");
    expect(created.guildId).toBe("2001");
    expect(created.name).toBe("release");
    expect(created.position).toBe(2);
    expect(resolved.id).toBe("3010");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/guilds/2001/channels");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "release" }));
  });

  test("createChannel sends category payload and maps category response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          channel: {
            channel_id: 3011,
            guild_id: 2001,
            type: "guild_category",
            name: "times",
            parent_id: null,
            position: 5,
            created_at: "2026-03-03T00:00:00Z",
          },
        }),
        { status: 201 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const created = await client.createChannel("2001", { name: "times", type: 4 });

    expect(created).toMatchObject({
      id: "3011",
      type: 4,
      guildId: "2001",
      name: "times",
      parentId: null,
      position: 5,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ name: "times", type: "guild_category" }));
  });

  test("createChannel sends parent_id for child text channels", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          channel: {
            channel_id: 3012,
            guild_id: 2001,
            type: "guild_text",
            name: "times-abe",
            parent_id: 3011,
            position: 6,
            created_at: "2026-03-03T00:00:00Z",
          },
        }),
        { status: 201 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const created = await client.createChannel("2001", {
      name: "times-abe",
      type: 0,
      parentId: "3011",
    });

    expect(created).toMatchObject({
      id: "3012",
      type: 0,
      parentId: "3011",
      position: 6,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(
      JSON.stringify({ name: "times-abe", type: "guild_text", parent_id: 3011 }),
    );
  });

  test("createChannel rejects unsupported channel types in v1", async () => {
    const client = new GuildChannelAPIClient();

    await expect(
      client.createChannel("2001", { name: "voice-room", type: 2 }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("updateChannel sends patch request and updates cached channel", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channels: [
              {
                channel_id: 3001,
                guild_id: 2001,
                name: "general",
                created_at: "2026-03-03T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channel: {
              channel_id: 3001,
              guild_id: 2001,
              name: "release-notes",
              created_at: "2026-03-03T00:00:00Z",
            },
          }),
          { status: 200 },
        ),
      );

    const client = new GuildChannelAPIClient();
    await client.getChannels("2001");
    const updated = await client.updateChannel("3001", { name: "  release-notes  " });
    const resolved = await client.getChannel("3001");

    expect(updated.name).toBe("release-notes");
    expect(resolved.name).toBe("release-notes");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/channels/3001");
    expect(init.method).toBe("PATCH");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "release-notes" }));
  });

  test("updateChannel rejects blank names before sending request", async () => {
    const client = new GuildChannelAPIClient();

    await expect(client.updateChannel("3001", { name: "   " })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("deleteChannel sends delete request and removes cached channel", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channels: [
              {
                channel_id: 3000,
                guild_id: 2001,
                type: "guild_category",
                name: "times",
                parent_id: null,
                position: 0,
                created_at: "2026-03-03T00:00:00Z",
              },
              {
                channel_id: 3001,
                guild_id: 2001,
                type: "guild_text",
                name: "times-abe",
                parent_id: 3000,
                position: 1,
                created_at: "2026-03-03T00:00:00Z",
              },
              {
                channel_id: 3002,
                guild_id: 2001,
                type: "guild_text",
                name: "random",
                parent_id: null,
                position: 2,
                created_at: "2026-03-03T00:00:30Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new GuildChannelAPIClient();
    await client.getChannels("2001");
    await client.deleteChannel("3000");
    const channels = await client.getChannels("2001");

    expect(channels.map((channel) => channel.id)).toEqual(["3002"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/channels/3000");
    expect(init.method).toBe("DELETE");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
  });

  test("getMyProfile maps profile response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            display_name: "alice",
            status_text: "busy coding",
            avatar_key: "avatar/alice.png",
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const profile = await client.getMyProfile();

    expect(profile).toEqual({
      displayName: "alice",
      statusText: "busy coding",
      avatarKey: "avatar/alice.png",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/users/me/profile");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
  });

  test("updateMyProfile sends partial patch body", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            display_name: "new-name",
            status_text: null,
            avatar_key: null,
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const profile = await client.updateMyProfile({
      displayName: "new-name",
      statusText: null,
    });

    expect(profile).toEqual({
      displayName: "new-name",
      statusText: null,
      avatarKey: null,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/users/me/profile");
    expect(init.method).toBe("PATCH");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ display_name: "new-name", status_text: null }));
  });

  test("updateMyProfile sends status-only patch body", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            display_name: "old-name",
            status_text: "focus mode",
            avatar_key: null,
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const profile = await client.updateMyProfile({
      statusText: "focus mode",
    });

    expect(profile).toEqual({
      displayName: "old-name",
      statusText: "focus mode",
      avatarKey: null,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/users/me/profile");
    expect(init.method).toBe("PATCH");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ status_text: "focus mode" }));
  });

  test("updateMyProfile rejects empty payload", async () => {
    const client = new GuildChannelAPIClient();

    await expect(client.updateMyProfile({})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("getPermissionSnapshot requests the non-v1 guild path", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: "req-permission-snapshot",
          snapshot: {
            guild_id: 2001,
            channel_id: 3001,
            guild: {
              can_view: true,
              can_create_channel: false,
              can_create_invite: false,
              can_manage_settings: false,
              can_moderate: false,
            },
            channel: {
              can_view: true,
              can_post: true,
              can_manage: false,
            },
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const snapshot = await client.getPermissionSnapshot("2001", { channelId: "3001" });

    expect(snapshot).toEqual({
      guildId: "2001",
      channelId: "3001",
      guild: {
        canView: true,
        canCreateChannel: false,
        canCreateInvite: false,
        canManageSettings: false,
        canModerate: false,
      },
      channel: {
        canView: true,
        canPost: true,
        canManage: false,
      },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/guilds/2001/permission-snapshot?channel_id=3001");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
  });

  test("returns typed error with request_id when backend error contract is returned", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "AUTHZ_DENIED",
          message: "access is denied by authorization policy",
          request_id: "req-403",
        }),
        {
          status: 403,
          headers: {
            "content-type": "application/json",
            "retry-after": "1",
          },
        },
      ),
    );

    const client = new GuildChannelAPIClient();

    try {
      await client.getServers();
      throw new Error("expected getServers to fail");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(GuildChannelApiError);
      if (!(error instanceof GuildChannelApiError)) {
        throw error;
      }
      expect(error.status).toBe(403);
      expect(error.code).toBe("AUTHZ_DENIED");
      expect(error.requestId).toBe("req-403");
      expect(error.retryAfterMs).toBe(1000);
    }
  });

  test("throws unexpected response error on schema mismatch", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ guilds: [{}] }), { status: 200 }));

    const client = new GuildChannelAPIClient();

    try {
      await client.getServers();
      throw new Error("expected getServers to fail");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(GuildChannelApiError);
      if (!(error instanceof GuildChannelApiError)) {
        throw error;
      }
      expect(error.status).toBe(200);
      expect(error.code).toBe("UNEXPECTED_RESPONSE");
    }
  });

  test("delays NEXT_PUBLIC_API_URL validation until first request", () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    expect(() => new GuildChannelAPIClient()).not.toThrow();
  });

  test("toUpdateActionErrorText maps backend channel-not-found code", () => {
    const error = new GuildChannelApiError("channel not found", {
      code: "CHANNEL_NOT_FOUND",
      requestId: "req-channel-404",
    });

    expect(toUpdateActionErrorText(error, "更新に失敗しました。")).toBe(
      "対象のチャンネルが見つかりません。 (request_id: req-channel-404)",
    );
  });

  test("toDeleteActionErrorText maps backend authz code", () => {
    const error = new GuildChannelApiError("denied", {
      code: "AUTHZ_DENIED",
      requestId: "req-delete-403",
    });

    expect(toDeleteActionErrorText(error, "削除に失敗しました。")).toBe(
      "この操作を行う権限がありません。 (request_id: req-delete-403)",
    );
  });

  test("toDeleteActionErrorText maps backend guild-not-found code", () => {
    const error = new GuildChannelApiError("missing", {
      code: "GUILD_NOT_FOUND",
      requestId: "req-delete-404",
    });

    expect(toDeleteActionErrorText(error, "削除に失敗しました。")).toBe(
      "対象のサーバーが見つかりません。 (request_id: req-delete-404)",
    );
  });
});
