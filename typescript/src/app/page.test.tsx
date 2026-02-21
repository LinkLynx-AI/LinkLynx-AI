import { describe, expect, test } from "vitest";
import HomePage from "./page";

describe("Home page", () => {
  test("ルートアクセスで /login へリダイレクトする", () => {
    try {
      HomePage();
      throw new Error("redirect was not triggered");
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      expect(error.message).toContain("NEXT_REDIRECT");
      const redirectError = error as Error & { digest?: string };
      expect(redirectError.digest ?? "").toContain("/login");
    }
  });
});
