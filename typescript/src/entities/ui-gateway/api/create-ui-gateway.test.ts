import { describe, expect, test } from "vitest";
import { createUiGateway } from "./create-ui-gateway";

describe("createUiGateway", () => {
  test("provider 未指定時は mock を返す", async () => {
    const gateway = createUiGateway();
    const content = await gateway.auth.getRouteContent("login");

    expect(content.title).toBe("ログイン");
  });

  test("provider が不正値なら fail-fast する", () => {
    expect(() => createUiGateway({ provider: "unknown-provider" })).toThrow(
      "Invalid NEXT_PUBLIC_UI_GATEWAY_PROVIDER:",
    );
  });

  test("provider=api 指定時は mock にフォールバックする", async () => {
    const gateway = createUiGateway({ provider: "api" });
    const content = await gateway.auth.getRouteContent("login");

    expect(content.title).toBe("ログイン");
  });

  test("環境変数指定の provider も同じルールで解決する", () => {
    const originalProvider = process.env.NEXT_PUBLIC_UI_GATEWAY_PROVIDER;
    try {
      process.env.NEXT_PUBLIC_UI_GATEWAY_PROVIDER = "invalid";
      expect(() => createUiGateway()).toThrow("Invalid NEXT_PUBLIC_UI_GATEWAY_PROVIDER:");
    } finally {
      if (originalProvider === undefined) {
        delete process.env.NEXT_PUBLIC_UI_GATEWAY_PROVIDER;
      } else {
        process.env.NEXT_PUBLIC_UI_GATEWAY_PROVIDER = originalProvider;
      }
    }
  });
});
