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
  toMessageActionErrorText,
  toUpdateActionErrorText,
} from "./guild-channel-api-client";
import { useAuthStore } from "@/shared/model/stores/auth-store";

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
    useAuthStore.setState({
      currentUser: {
        id: "9003",
        username: "alice",
        displayName: "Alice",
        avatar: null,
        status: "online",
        customStatus: null,
        bot: false,
      },
      currentPrincipalId: "9003",
      status: "online",
      customStatus: null,
    });
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

  test("getMembers maps guild member directory response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          members: [
            {
              user_id: 1001,
              display_name: "Alice",
              avatar_key: null,
              status_text: "Ready",
              nickname: "alice-owner",
              joined_at: "2026-03-03T00:00:00Z",
              role_keys: ["owner"],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const members = await client.getMembers("2001");

    expect(members).toEqual([
      {
        user: {
          id: "1001",
          username: "Alice",
          displayName: "Alice",
          avatar: null,
          status: "offline",
          customStatus: "Ready",
          bot: false,
        },
        nick: "alice-owner",
        roles: ["owner"],
        joinedAt: "2026-03-03T00:00:00Z",
        avatar: null,
      },
    ]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/guilds/2001/members");
    expect(init.method).toBe("GET");
  });

  test("getRoles maps guild role directory response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          roles: [
            {
              role_key: "admin",
              name: "Admin",
              priority: 200,
              allow_manage: true,
              member_count: 3,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const roles = await client.getRoles("2001");

    expect(roles).toEqual([
      {
        id: "admin",
        name: "Admin",
        color: "#99aab5",
        position: 200,
        permissions: 1,
        mentionable: false,
        hoist: true,
        memberCount: 3,
      },
    ]);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/guilds/2001/roles");
  });

  test("getUserProfile maps shared user profile response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            user_id: 1003,
            display_name: "Carol",
            status_text: "Reviewing",
            avatar_key: null,
            banner_key: null,
            created_at: "2026-03-03T00:00:00Z",
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const profile = await client.getUserProfile("1003");

    expect(profile).toEqual({
      id: "1003",
      username: "Carol",
      displayName: "Carol",
      avatar: null,
      status: "offline",
      customStatus: "Reviewing",
      bot: false,
      banner: null,
      bio: "Reviewing",
      accentColor: null,
      badges: [],
      createdAt: "2026-03-03T00:00:00Z",
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/users/1003/profile");
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
            banner_key: "banner/alice.png",
            theme: "dark",
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
      bannerKey: "banner/alice.png",
      theme: "dark",
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
            banner_key: null,
            theme: "light",
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const profile = await client.updateMyProfile({
      displayName: "new-name",
      statusText: null,
      theme: "light",
    });

    expect(profile).toEqual({
      displayName: "new-name",
      statusText: null,
      avatarKey: null,
      bannerKey: null,
      theme: "light",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/users/me/profile");
    expect(init.method).toBe("PATCH");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(
      JSON.stringify({ display_name: "new-name", status_text: null, theme: "light" }),
    );
  });

  test("updateMyProfile sends status-only patch body", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            display_name: "old-name",
            status_text: "focus mode",
            avatar_key: null,
            banner_key: "banner/alice.png",
            theme: "dark",
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
      bannerKey: "banner/alice.png",
      theme: "dark",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/users/me/profile");
    expect(init.method).toBe("PATCH");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ status_text: "focus mode" }));
  });

  test("updateMyProfile sends theme-only patch body", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            display_name: "old-name",
            status_text: "focus mode",
            avatar_key: null,
            theme: "light",
            banner_key: null,
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const profile = await client.updateMyProfile({
      theme: "light",
    });

    expect(profile).toEqual({
      displayName: "old-name",
      statusText: "focus mode",
      avatarKey: null,
      theme: "light",
      bannerKey: null,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/users/me/profile");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ theme: "light" }));
  });

  test("updateMyProfile sends banner key patch body", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            display_name: "old-name",
            status_text: "busy",
            avatar_key: "avatar/alice.png",
            theme: "dark",
            banner_key: "v0/tenant/default/user/1001/profile/banner/asset/a1/banner.png",
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const profile = await client.updateMyProfile({
      bannerKey: "v0/tenant/default/user/1001/profile/banner/asset/a1/banner.png",
    });

    expect(profile).toEqual({
      displayName: "old-name",
      statusText: "busy",
      avatarKey: "avatar/alice.png",
      theme: "dark",
      bannerKey: "v0/tenant/default/user/1001/profile/banner/asset/a1/banner.png",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/users/me/profile");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(
      JSON.stringify({
        banner_key: "v0/tenant/default/user/1001/profile/banner/asset/a1/banner.png",
      }),
    );
  });

  test("updateMyProfile rejects empty payload", async () => {
    const client = new GuildChannelAPIClient();

    await expect(client.updateMyProfile({})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("createMyProfileMediaUploadUrl maps upload contract", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          upload: {
            target: "avatar",
            object_key: "v0/tenant/default/user/1001/profile/avatar/asset/a1/avatar.png",
            upload_url: "https://storage.googleapis.com/profile-media/avatar-upload",
            expires_at: "2026-03-08T12:00:00Z",
            method: "PUT",
            required_headers: {
              "content-type": "image/png",
            },
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const upload = await client.createMyProfileMediaUploadUrl({
      target: "avatar",
      filename: "avatar.png",
      contentType: "image/png",
    });

    expect(upload).toEqual({
      target: "avatar",
      objectKey: "v0/tenant/default/user/1001/profile/avatar/asset/a1/avatar.png",
      uploadUrl: "https://storage.googleapis.com/profile-media/avatar-upload",
      expiresAt: "2026-03-08T12:00:00Z",
      method: "PUT",
      requiredHeaders: {
        "content-type": "image/png",
      },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/users/me/profile/media/upload-url");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({
        target: "avatar",
        filename: "avatar.png",
        content_type: "image/png",
      }),
    );
  });

  test("getMyProfileMediaDownloadUrl maps download contract", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          media: {
            target: "banner",
            object_key: "v0/tenant/default/user/1001/profile/banner/asset/a1/banner.png",
            download_url: "https://storage.googleapis.com/profile-media/banner-download",
            expires_at: "2026-03-08T12:00:00Z",
          },
        }),
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const media = await client.getMyProfileMediaDownloadUrl("banner");

    expect(media).toEqual({
      target: "banner",
      objectKey: "v0/tenant/default/user/1001/profile/banner/asset/a1/banner.png",
      downloadUrl: "https://storage.googleapis.com/profile-media/banner-download",
      expiresAt: "2026-03-08T12:00:00Z",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/users/me/profile/media/banner/download-url");
    expect(init.method).toBe("GET");
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

  test("getMessages maps paged response and hydrates current author", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        `{
          "items": [
            {
              "message_id": 9223372036854775001,
              "guild_id": 2001,
              "channel_id": 3001,
              "author_id": 9003,
              "content": "hello realtime",
              "created_at": "2026-03-10T10:00:00Z",
              "version": 1,
              "edited_at": null,
              "is_deleted": false
            }
          ],
          "next_before": "cursor-1",
          "next_after": null,
          "has_more": true
        }`,
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const page = await client.getMessages({
      guildId: "2001",
      channelId: "3001",
      limit: 25,
    });

    expect(page).toEqual({
      items: [
        expect.objectContaining({
          id: "9223372036854775001",
          channelId: "3001",
          content: "hello realtime",
          author: expect.objectContaining({
            id: "9003",
            displayName: "Alice",
          }),
        }),
      ],
      nextBefore: "cursor-1",
      nextAfter: null,
      hasMore: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/guilds/2001/channels/3001/messages?limit=25");
    expect(init.method).toBe("GET");
  });

  test("sendMessage posts to v1 guild message path", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        `{
          "message": {
            "message_id": 9223372036854775002,
            "guild_id": 2001,
            "channel_id": 3001,
            "author_id": 9003,
            "content": "hello contract",
            "created_at": "2026-03-10T10:01:00Z",
            "version": 1,
            "edited_at": null,
            "is_deleted": false
          }
        }`,
        { status: 201 },
      ),
    );

    const client = new GuildChannelAPIClient();
    const message = await client.sendMessage({
      guildId: "2001",
      channelId: "3001",
      data: { content: "  hello contract  " },
    });

    expect(message.content).toBe("hello contract");
    expect(message.id).toBe("9223372036854775002");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/guilds/2001/channels/3001/messages");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ content: "hello contract" }));
    expect(new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
  });

  test("editMessage calls PATCH message endpoint with expectedVersion", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        `{
          "message": {
            "message_id": 9223372036854775002,
            "guild_id": 2001,
            "channel_id": 3001,
            "author_id": 9003,
            "content": "edited",
            "created_at": "2026-03-10T10:01:00Z",
            "version": 2,
            "edited_at": "2026-03-10T10:02:00Z",
            "is_deleted": false
          }
        }`,
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    (
      client as unknown as {
        channelIndex: Map<string, { guildId: string }>;
      }
    ).channelIndex.set("3001", { guildId: "2001" });

    const message = await client.editMessage("3001", "5001", {
      content: "edited",
      expectedVersion: "1",
    });

    expect(message.content).toBe("edited");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/guilds/2001/channels/3001/messages/5001");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ content: "edited", expected_version: 1 }));
  });

  test("deleteMessage calls DELETE message endpoint and returns tombstone snapshot", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        `{
          "message": {
            "message_id": 9223372036854775002,
            "guild_id": 2001,
            "channel_id": 3001,
            "author_id": 9003,
            "content": "",
            "created_at": "2026-03-10T10:01:00Z",
            "version": 3,
            "edited_at": "2026-03-10T10:03:00Z",
            "is_deleted": true
          }
        }`,
        { status: 200 },
      ),
    );

    const client = new GuildChannelAPIClient();
    (
      client as unknown as {
        channelIndex: Map<string, { guildId: string }>;
      }
    ).channelIndex.set("3001", { guildId: "2001" });

    const message = await client.deleteMessage("3001", "5001", {
      expectedVersion: "2",
    });

    expect(message.isDeleted).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/guilds/2001/channels/3001/messages/5001");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBe(JSON.stringify({ expected_version: 2 }));
  });

  test("unavailable pin and reaction methods return v1 placeholder contracts", async () => {
    const client = new GuildChannelAPIClient();

    await expect(client.getPinnedMessages("3001")).resolves.toEqual([]);

    await expect(client.addReaction("3001", "5001", "👍")).rejects.toMatchObject({
      code: "FEATURE_UNAVAILABLE",
      status: 501,
    });
    await expect(client.removeReaction("3001", "5001", "👍")).rejects.toMatchObject({
      code: "FEATURE_UNAVAILABLE",
      status: 501,
    });
    await expect(client.pinMessage("3001", "5001")).rejects.toMatchObject({
      code: "FEATURE_UNAVAILABLE",
      status: 501,
    });
    await expect(client.unpinMessage("3001", "5001")).rejects.toMatchObject({
      code: "FEATURE_UNAVAILABLE",
      status: 501,
    });
  });

  test("toUpdateActionErrorText maps message conflict", () => {
    const error = new GuildChannelApiError("conflict", {
      code: "MESSAGE_CONFLICT",
      requestId: "req-edit-409",
    });

    expect(toUpdateActionErrorText(error, "更新に失敗しました。")).toBe(
      "メッセージが更新されています。最新状態を読み直しました。 (request_id: req-edit-409)",
    );
  });

  test("toDeleteActionErrorText maps message conflict", () => {
    const error = new GuildChannelApiError("conflict", {
      code: "MESSAGE_CONFLICT",
      requestId: "req-delete-409",
    });

    expect(toDeleteActionErrorText(error, "削除に失敗しました。")).toBe(
      "メッセージの状態が変わっています。最新状態を読み直しました。 (request_id: req-delete-409)",
    );
  });

  test("toMessageActionErrorText includes retry-after seconds for rate limit", () => {
    const error = new GuildChannelApiError("rate limited", {
      code: "RATE_LIMITED",
      requestId: "req-rate-limit",
      retryAfterMs: 2000,
    });

    expect(toMessageActionErrorText(error, "送信に失敗しました。")).toBe(
      "送信が多すぎます。少し待ってから再試行してください。（約 2 秒後に再試行してください） (request_id: req-rate-limit)",
    );
  });
});
