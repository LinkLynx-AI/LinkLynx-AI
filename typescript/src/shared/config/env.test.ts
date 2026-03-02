import { describe, expect, it } from "vitest";
import { parseFrontendEnv } from "./env";

function createValidEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    NEXT_PUBLIC_API_URL: "http://localhost:8080",
    NEXT_PUBLIC_FIREBASE_API_KEY: "dummy-api-key",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "example-project",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "example.appspot.com",
  };
}

describe("parseFrontendEnv", () => {
  it("parses required frontend env values", () => {
    const result = parseFrontendEnv(createValidEnv());

    expect(result.NEXT_PUBLIC_API_URL).toBe("http://localhost:8080");
    expect(result.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe("example-project");
  });

  it("throws when required env is missing", () => {
    const missingEnv = {
      ...createValidEnv(),
      NEXT_PUBLIC_FIREBASE_API_KEY: undefined,
    };

    expect(() => parseFrontendEnv(missingEnv)).toThrow(
      "NEXT_PUBLIC_FIREBASE_API_KEY",
    );
  });

  it("throws when NEXT_PUBLIC_API_URL is invalid", () => {
    const invalidUrlEnv = {
      ...createValidEnv(),
      NEXT_PUBLIC_API_URL: "not-a-url",
    };

    expect(() => parseFrontendEnv(invalidUrlEnv)).toThrow("NEXT_PUBLIC_API_URL");
  });
});
