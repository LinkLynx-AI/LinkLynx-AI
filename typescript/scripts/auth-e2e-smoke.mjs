#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const MODE_SCHEMA = z.enum(["happy-path", "dependency-unavailable", "full-discord-flow"]);
const ENV_SCHEMA = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().trim().min(1),
  AUTH_SMOKE_EMAIL: z.string().trim().email(),
  AUTH_SMOKE_PASSWORD: z.string().trim().min(1),
});
const LOGIN_RESPONSE_SCHEMA = z.object({
  idToken: z.string().trim().min(1),
  localId: z.string().trim().min(1),
});
const PROTECTED_PING_SUCCESS_SCHEMA = z.object({
  ok: z.literal(true),
  request_id: z.string().trim().min(1),
  principal_id: z.number().int().positive(),
  firebase_uid: z.string().trim().min(1),
});
const BACKEND_ERROR_SCHEMA = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  request_id: z.string().trim().min(1),
});
const GUILD_CREATE_RESPONSE_SCHEMA = z.object({
  guild: z.object({
    guild_id: z.number().int().positive(),
    name: z.string().trim().min(1),
    owner_id: z.number().int().positive(),
  }),
});
const CHANNEL_SUMMARY_SCHEMA = z.object({
  channel_id: z.number().int().positive(),
  guild_id: z.number().int().positive(),
  name: z.string().trim().min(1),
});
const CHANNEL_LIST_RESPONSE_SCHEMA = z.object({
  channels: z.array(CHANNEL_SUMMARY_SCHEMA),
});
const CHANNEL_CREATE_RESPONSE_SCHEMA = z.object({
  channel: CHANNEL_SUMMARY_SCHEMA,
});
const MESSAGE_ITEM_SCHEMA = z.object({
  message_id: z.number().int().positive(),
  guild_id: z.number().int().positive(),
  channel_id: z.number().int().positive(),
  author_id: z.number().int().positive(),
  content: z.string(),
  created_at: z.string().trim().min(1),
  version: z.number().int().positive(),
  edited_at: z.string().trim().min(1).nullable().optional(),
  is_deleted: z.boolean().optional(),
});
const MESSAGE_CREATE_RESPONSE_SCHEMA = z.object({
  message: MESSAGE_ITEM_SCHEMA,
});
const MESSAGE_LIST_RESPONSE_SCHEMA = z.object({
  items: z.array(MESSAGE_ITEM_SCHEMA),
  next_before: z.string().trim().min(1).nullable(),
  next_after: z.string().trim().min(1).nullable(),
  has_more: z.boolean(),
});
const MODERATION_REPORT_RESPONSE_SCHEMA = z.object({
  report: z.object({
    report_id: z.number().int().positive(),
    guild_id: z.number().int().positive(),
    reporter_id: z.number().int().positive(),
    target_type: z.enum(["message", "user"]),
    target_id: z.number().int().positive(),
    reason: z.string().trim().min(1),
    status: z.enum(["open", "resolved"]),
    created_at: z.string().trim().min(1),
    updated_at: z.string().trim().min(1),
  }),
});
const WS_TICKET_SUCCESS_SCHEMA = z.object({
  ticket: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1),
});
const WS_READY_SCHEMA = z.object({
  type: z.literal("auth.ready"),
  d: z.object({
    principalId: z.number().int().positive(),
  }),
});
const FIREBASE_ERROR_SCHEMA = z.object({
  error: z.object({
    message: z.string().trim().min(1),
  }),
});

const DEFAULT_TIMEOUT_MS = 10_000;

function logStep(message) {
  console.log(`[auth-smoke] ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function isSuccessMode(mode) {
  return mode === "happy-path" || mode === "full-discord-flow";
}

export function parseArgs(argv) {
  let mode = "happy-path";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") {
      const next = argv[index + 1];
      if (next === undefined) {
        fail("--mode requires a value.");
      }
      mode = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length);
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return {
    mode: MODE_SCHEMA.parse(mode),
  };
}

export function parseEnvFileLine(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadLocalEnv() {
  const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
  if (!existsSync(envPath)) {
    return;
  }

  const file = readFileSync(envPath, "utf8");
  for (const line of file.split(/\r?\n/u)) {
    const parsed = parseEnvFileLine(line);
    if (parsed === null) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function resolveEnv() {
  loadLocalEnv();
  return ENV_SCHEMA.parse(process.env);
}

export function createApiUrl(baseUrl, path) {
  const url = new URL(baseUrl);
  const normalizedPathname = url.pathname.replace(/\/+$/u, "");
  url.pathname = `${normalizedPathname}${path}`.replace(/\/{2,}/gu, "/");
  url.search = "";
  url.hash = "";
  return url;
}

export function createWsUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    fail("NEXT_PUBLIC_API_URL must use http or https.");
  }
  if (url.username !== "" || url.password !== "") {
    fail("NEXT_PUBLIC_API_URL must not contain userinfo.");
  }
  if (url.hostname.trim().length === 0) {
    fail("NEXT_PUBLIC_API_URL must include a hostname.");
  }

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const normalizedPathname = url.pathname.replace(/\/+$/u, "");
  url.pathname = `${normalizedPathname}/ws`.replace(/\/{2,}/gu, "/");
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    fail(`Expected JSON response from ${response.url}, but parsing failed.`);
  }
}

async function loginWithFirebase(env) {
  logStep("Logging in with Firebase test user.");

  const loginUrl = new URL("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword");
  loginUrl.searchParams.set("key", env.NEXT_PUBLIC_FIREBASE_API_KEY);

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: env.AUTH_SMOKE_EMAIL,
      password: env.AUTH_SMOKE_PASSWORD,
      returnSecureToken: true,
    }),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const parsedError = FIREBASE_ERROR_SCHEMA.safeParse(payload);
    if (parsedError.success) {
      fail(`Firebase login failed: ${parsedError.data.error.message}.`);
    }
    fail(`Firebase login failed with unexpected response status ${response.status}.`);
  }

  const parsed = LOGIN_RESPONSE_SCHEMA.safeParse(payload);
  if (!parsed.success) {
    fail("Firebase login response shape is invalid.");
  }

  return parsed.data;
}

async function callProtectedPing(apiBaseUrl, idToken) {
  logStep("Calling protected ping.");

  const response = await fetch(createApiUrl(apiBaseUrl, "/protected/ping"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  const payload = await parseJsonResponse(response);

  return {
    status: response.status,
    payload,
  };
}

async function issueWsTicket(apiBaseUrl, idToken) {
  logStep("Issuing WS ticket.");

  const response = await fetch(createApiUrl(apiBaseUrl, "/auth/ws-ticket"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const parsedError = BACKEND_ERROR_SCHEMA.safeParse(payload);
    if (parsedError.success) {
      fail(
        `WS ticket issuance failed with status ${response.status}: ${parsedError.data.code} (request_id: ${parsedError.data.request_id}).`,
      );
    }
    fail(`WS ticket issuance failed with unexpected response status ${response.status}.`);
  }

  const parsed = WS_TICKET_SUCCESS_SCHEMA.safeParse(payload);
  if (!parsed.success) {
    fail("WS ticket response shape is invalid.");
  }

  return parsed.data;
}

async function waitForSocketResult(params) {
  const { apiBaseUrl, ticket, mode, expectedPrincipalId } = params;
  if (typeof WebSocket === "undefined") {
    fail("Global WebSocket is not available in this Node runtime.");
  }

  logStep(`Connecting to ${createWsUrl(apiBaseUrl)}.`);

  return await new Promise((resolvePromise, rejectPromise) => {
    const socket = new WebSocket(createWsUrl(apiBaseUrl));
    let settled = false;
    const timeout = setTimeout(() => {
      finish(() => {
        socket.close();
        rejectPromise(new Error(`Timed out waiting for WS ${mode} result.`));
      });
    }, DEFAULT_TIMEOUT_MS);

    function finish(callback) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      callback();
    }

    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          type: "auth.identify",
          d: {
            method: "ticket",
            ticket,
          },
        }),
      );
    });

    socket.addEventListener("message", (event) => {
      if (!isSuccessMode(mode)) {
        finish(() => {
          socket.close();
          rejectPromise(
            new Error(`Expected WS close 1011, but received message: ${String(event.data)}`),
          );
        });
        return;
      }

      let payload;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        finish(() => {
          socket.close();
          rejectPromise(new Error("WS ready message is not valid JSON."));
        });
        return;
      }

      const parsed = WS_READY_SCHEMA.safeParse(payload);
      if (!parsed.success) {
        finish(() => {
          socket.close();
          rejectPromise(new Error("WS ready message shape is invalid."));
        });
        return;
      }

      if (parsed.data.d.principalId !== expectedPrincipalId) {
        finish(() => {
          socket.close();
          rejectPromise(
            new Error(
              `WS principal mismatch: expected ${expectedPrincipalId}, got ${parsed.data.d.principalId}.`,
            ),
          );
        });
        return;
      }

      finish(() => {
        socket.close();
        resolvePromise({
          closeCode: null,
          closeReason: null,
          principalId: parsed.data.d.principalId,
        });
      });
    });

    socket.addEventListener("close", (event) => {
      if (isSuccessMode(mode)) {
        if (settled) {
          return;
        }
        finish(() => {
          rejectPromise(
            new Error(
              `WS closed before auth.ready: code=${event.code}, reason=${event.reason || "<empty>"}.`,
            ),
          );
        });
        return;
      }

      finish(() => {
        resolvePromise({
          closeCode: event.code,
          closeReason: event.reason,
          principalId: null,
        });
      });
    });

    socket.addEventListener("error", () => {
      finish(() => {
        rejectPromise(new Error("WebSocket connection failed before expected result."));
      });
    });
  });
}

async function authorizedJsonRequest(params) {
  const { apiBaseUrl, idToken, path, method, schema, expectedStatus, body, extraHeaders } = params;
  const headers = new Headers({
    Authorization: `Bearer ${idToken}`,
  });
  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (extraHeaders !== undefined) {
    new Headers(extraHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const response = await fetch(createApiUrl(apiBaseUrl, path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const parsedError = BACKEND_ERROR_SCHEMA.safeParse(payload);
    if (parsedError.success) {
      fail(
        `${method} ${path} failed with status ${response.status}: ${parsedError.data.code} (request_id: ${parsedError.data.request_id}).`,
      );
    }
    fail(`${method} ${path} failed with unexpected response status ${response.status}.`);
  }

  if (response.status !== expectedStatus) {
    fail(`${method} ${path} returned ${response.status}, expected ${expectedStatus}.`);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    fail(`${method} ${path} response shape is invalid.`);
  }

  return parsed.data;
}

async function authorizedNoContentRequest(params) {
  const { apiBaseUrl, idToken, path, method } = params;
  const response = await fetch(createApiUrl(apiBaseUrl, path), {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (response.status === 204) {
    return;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    fail(`${method} ${path} failed with unexpected response status ${response.status}.`);
  }

  const parsedError = BACKEND_ERROR_SCHEMA.safeParse(payload);
  if (parsedError.success) {
    fail(
      `${method} ${path} failed with status ${response.status}: ${parsedError.data.code} (request_id: ${parsedError.data.request_id}).`,
    );
  }
  fail(`${method} ${path} failed with unexpected response status ${response.status}.`);
}

async function createGuild(apiBaseUrl, idToken) {
  const name = `auth-smoke-${Date.now()}`;
  logStep(`Creating smoke guild ${name}.`);

  return await authorizedJsonRequest({
    apiBaseUrl,
    idToken,
    path: "/guilds",
    method: "POST",
    schema: GUILD_CREATE_RESPONSE_SCHEMA,
    expectedStatus: 201,
    body: { name },
  });
}

async function createGuildChannel(apiBaseUrl, idToken, guildId) {
  const name = `smoke-${Date.now()}`;
  logStep(`Creating smoke channel ${name} in guild ${guildId}.`);

  return await authorizedJsonRequest({
    apiBaseUrl,
    idToken,
    path: `/guilds/${guildId}/channels`,
    method: "POST",
    schema: CHANNEL_CREATE_RESPONSE_SCHEMA,
    expectedStatus: 201,
    body: { name, type: "guild_text" },
  });
}

async function listGuildChannels(apiBaseUrl, idToken, guildId) {
  logStep(`Listing channels for guild ${guildId}.`);

  return await authorizedJsonRequest({
    apiBaseUrl,
    idToken,
    path: `/guilds/${guildId}/channels`,
    method: "GET",
    schema: CHANNEL_LIST_RESPONSE_SCHEMA,
    expectedStatus: 200,
  });
}

async function listChannelMessages(apiBaseUrl, idToken, guildId, channelId) {
  logStep(`Listing messages for guild ${guildId} channel ${channelId}.`);

  return await authorizedJsonRequest({
    apiBaseUrl,
    idToken,
    path: `/v1/guilds/${guildId}/channels/${channelId}/messages`,
    method: "GET",
    schema: MESSAGE_LIST_RESPONSE_SCHEMA,
    expectedStatus: 200,
  });
}

async function createChannelMessage(apiBaseUrl, idToken, guildId, channelId, principalId) {
  const content = `full-discord-flow ${Date.now()}`;
  logStep(`Creating smoke message in guild ${guildId} channel ${channelId}.`);

  return await authorizedJsonRequest({
    apiBaseUrl,
    idToken,
    path: `/v1/guilds/${guildId}/channels/${channelId}/messages`,
    method: "POST",
    schema: MESSAGE_CREATE_RESPONSE_SCHEMA,
    expectedStatus: 201,
    body: { content },
    extraHeaders: {
      "Idempotency-Key": `auth-smoke-${principalId}-${Date.now()}`,
    },
  });
}

async function createModerationReport(apiBaseUrl, idToken, guildId, messageId) {
  logStep(`Creating moderation report for message ${messageId}.`);

  return await authorizedJsonRequest({
    apiBaseUrl,
    idToken,
    path: `/guilds/${guildId}/moderation/reports`,
    method: "POST",
    schema: MODERATION_REPORT_RESPONSE_SCHEMA,
    expectedStatus: 201,
    body: {
      target_type: "message",
      target_id: messageId,
      reason: "auth smoke moderation flow",
    },
  });
}

async function resolveModerationReport(apiBaseUrl, idToken, guildId, reportId) {
  logStep(`Resolving moderation report ${reportId}.`);

  return await authorizedJsonRequest({
    apiBaseUrl,
    idToken,
    path: `/guilds/${guildId}/moderation/reports/${reportId}/resolve`,
    method: "POST",
    schema: MODERATION_REPORT_RESPONSE_SCHEMA,
    expectedStatus: 200,
  });
}

async function deleteGuild(apiBaseUrl, idToken, guildId) {
  logStep(`Cleaning up smoke guild ${guildId}.`);

  await authorizedNoContentRequest({
    apiBaseUrl,
    idToken,
    path: `/guilds/${guildId}`,
    method: "DELETE",
  });
}

async function runFullDiscordFlow(params) {
  const { apiBaseUrl, idToken, principalId } = params;
  let guildId = null;

  try {
    const createdGuild = await createGuild(apiBaseUrl, idToken);
    guildId = createdGuild.guild.guild_id;
    const createdChannel = await createGuildChannel(apiBaseUrl, idToken, guildId);
    const channelId = createdChannel.channel.channel_id;

    const channels = await listGuildChannels(apiBaseUrl, idToken, guildId);
    if (!channels.channels.some((channel) => channel.channel_id === channelId)) {
      fail(`Created channel ${channelId} was not returned by list_guild_channels.`);
    }

    await listChannelMessages(apiBaseUrl, idToken, guildId, channelId);
    const createdMessage = await createChannelMessage(
      apiBaseUrl,
      idToken,
      guildId,
      channelId,
      principalId,
    );
    const messageId = createdMessage.message.message_id;

    const messages = await listChannelMessages(apiBaseUrl, idToken, guildId, channelId);
    if (!messages.items.some((message) => message.message_id === messageId)) {
      fail(`Created message ${messageId} was not returned by list_channel_messages.`);
    }

    const createdReport = await createModerationReport(apiBaseUrl, idToken, guildId, messageId);
    if (createdReport.report.target_id !== messageId) {
      fail(
        `Moderation report target mismatch: expected ${messageId}, got ${createdReport.report.target_id}.`,
      );
    }

    const resolvedReport = await resolveModerationReport(
      apiBaseUrl,
      idToken,
      guildId,
      createdReport.report.report_id,
    );
    if (resolvedReport.report.status !== "resolved") {
      fail(
        `Moderation report ${createdReport.report.report_id} status was ${resolvedReport.report.status}, expected resolved.`,
      );
    }

    logStep(
      `Full discord flow passed (guild_id: ${guildId}, channel_id: ${channelId}, message_id: ${messageId}, report_id: ${createdReport.report.report_id}).`,
    );
  } finally {
    if (guildId !== null) {
      await deleteGuild(apiBaseUrl, idToken, guildId);
    }
  }
}

function assertHappyPathPing(result, localId) {
  if (result.status !== 200) {
    fail(`Protected ping returned ${result.status}, expected 200.`);
  }

  const parsed = PROTECTED_PING_SUCCESS_SCHEMA.safeParse(result.payload);
  if (!parsed.success) {
    fail("Protected ping success response shape is invalid.");
  }

  if (parsed.data.firebase_uid !== localId) {
    fail(
      `Firebase UID mismatch: expected ${localId}, got ${parsed.data.firebase_uid} (request_id: ${parsed.data.request_id}).`,
    );
  }

  logStep(
    `Protected ping passed (request_id: ${parsed.data.request_id}, principal_id: ${parsed.data.principal_id}).`,
  );

  return parsed.data;
}

function assertDependencyUnavailablePing(result) {
  if (result.status !== 503) {
    fail(`Protected ping returned ${result.status}, expected 503.`);
  }

  const parsed = BACKEND_ERROR_SCHEMA.safeParse(result.payload);
  if (!parsed.success) {
    fail("Protected ping error response shape is invalid.");
  }

  if (parsed.data.code !== "AUTHZ_UNAVAILABLE") {
    fail(
      `Protected ping returned ${parsed.data.code}, expected AUTHZ_UNAVAILABLE (request_id: ${parsed.data.request_id}).`,
    );
  }

  logStep(
    `Protected ping failed as expected (request_id: ${parsed.data.request_id}, code: ${parsed.data.code}).`,
  );
}

function assertDependencyUnavailableWs(result) {
  if (result.closeCode !== 1011) {
    fail(`WS closed with ${result.closeCode}, expected 1011.`);
  }
  if (result.closeReason !== "AUTHZ_UNAVAILABLE") {
    fail(`WS close reason was ${result.closeReason || "<empty>"}, expected AUTHZ_UNAVAILABLE.`);
  }

  logStep(
    `WS identify failed as expected (code: ${result.closeCode}, reason: ${result.closeReason}).`,
  );
}

async function main() {
  const { mode } = parseArgs(process.argv.slice(2));
  const env = resolveEnv();
  const loginResult = await loginWithFirebase(env);
  const protectedPingResult = await callProtectedPing(env.NEXT_PUBLIC_API_URL, loginResult.idToken);

  if (isSuccessMode(mode)) {
    const protectedPing = assertHappyPathPing(protectedPingResult, loginResult.localId);
    const wsTicket = await issueWsTicket(env.NEXT_PUBLIC_API_URL, loginResult.idToken);
    const wsResult = await waitForSocketResult({
      apiBaseUrl: env.NEXT_PUBLIC_API_URL,
      ticket: wsTicket.ticket,
      mode,
      expectedPrincipalId: protectedPing.principal_id,
    });

    logStep(`WS identify passed (principal_id: ${wsResult.principalId}).`);
    if (mode === "full-discord-flow") {
      await runFullDiscordFlow({
        apiBaseUrl: env.NEXT_PUBLIC_API_URL,
        idToken: loginResult.idToken,
        principalId: protectedPing.principal_id,
      });
    }
    logStep("Smoke test completed successfully.");
    return;
  }

  assertDependencyUnavailablePing(protectedPingResult);
  const wsTicket = await issueWsTicket(env.NEXT_PUBLIC_API_URL, loginResult.idToken);
  const wsResult = await waitForSocketResult({
    apiBaseUrl: env.NEXT_PUBLIC_API_URL,
    ticket: wsTicket.ticket,
    mode,
    expectedPrincipalId: null,
  });
  assertDependencyUnavailableWs(wsResult);
  logStep("Dependency-unavailable smoke test completed successfully.");
}

const isExecutedAsScript =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isExecutedAsScript) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[auth-smoke] ${message}`);
    process.exitCode = 1;
  });
}
