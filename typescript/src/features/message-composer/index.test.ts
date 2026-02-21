import { describe, expect, test } from "vitest";
import { resolveComposerEnterAction } from "./index";

describe("resolveComposerEnterAction", () => {
  test("Enter 単押しは submit を返す", () => {
    expect(
      resolveComposerEnterAction({
        key: "Enter",
        shiftKey: false,
      }),
    ).toBe("submit");
  });

  test("Shift+Enter は newline を返す", () => {
    expect(
      resolveComposerEnterAction({
        key: "Enter",
        shiftKey: true,
      }),
    ).toBe("newline");
  });

  test("Enter 以外のキーは none を返す", () => {
    expect(
      resolveComposerEnterAction({
        key: "a",
        shiftKey: false,
      }),
    ).toBe("none");
  });

  test("IME 変換中の Enter は none を返す", () => {
    expect(
      resolveComposerEnterAction({
        key: "Enter",
        shiftKey: false,
        isComposing: true,
      }),
    ).toBe("none");
  });
});
