import { describe, expect, test } from "vitest";
import { createApiUrl, createWsUrl, parseArgs, parseEnvFileLine } from "./auth-e2e-smoke.mjs";

describe("auth-e2e-smoke", () => {
  test("parseArgs parses --mode=value", () => {
    expect(parseArgs(["--mode=dependency-unavailable"])).toEqual({
      mode: "dependency-unavailable",
    });
  });

  test("parseArgs rejects unknown flags", () => {
    expect(() => parseArgs(["--unexpected"])).toThrow("Unknown argument");
  });

  test("createApiUrl preserves base path and appends endpoint", () => {
    expect(createApiUrl("https://api.example.com/v1/", "/protected/ping").toString()).toBe(
      "https://api.example.com/v1/protected/ping",
    );
  });

  test("createWsUrl converts http api url into ws endpoint", () => {
    expect(createWsUrl("http://localhost:8080/api")).toBe("ws://localhost:8080/api/ws");
  });

  test("createWsUrl rejects userinfo", () => {
    expect(() => createWsUrl("https://user:pass@example.com")).toThrow("must not contain userinfo");
  });

  test("parseEnvFileLine ignores comments and unwraps quoted values", () => {
    expect(parseEnvFileLine("# comment")).toBeNull();
    expect(parseEnvFileLine('AUTH_SMOKE_EMAIL="user@example.com"')).toEqual({
      key: "AUTH_SMOKE_EMAIL",
      value: "user@example.com",
    });
  });
});
