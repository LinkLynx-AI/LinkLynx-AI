#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const MODE_SCHEMA = z.enum(["happy-path", "dependency-unavailable"]);
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
      if (mode !== "happy-path") {
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
      if (mode === "happy-path") {
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

  if (mode === "happy-path") {
    const protectedPing = assertHappyPathPing(protectedPingResult, loginResult.localId);
    const wsTicket = await issueWsTicket(env.NEXT_PUBLIC_API_URL, loginResult.idToken);
    const wsResult = await waitForSocketResult({
      apiBaseUrl: env.NEXT_PUBLIC_API_URL,
      ticket: wsTicket.ticket,
      mode,
      expectedPrincipalId: protectedPing.principal_id,
    });

    logStep(`WS identify passed (principal_id: ${wsResult.principalId}).`);
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
