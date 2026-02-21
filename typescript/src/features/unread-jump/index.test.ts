import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { UnreadJumpButton, shouldShowUnreadJump } from "@/features/unread-jump";

describe("shouldShowUnreadJump", () => {
  test("最下部では未読があっても表示しない", () => {
    expect(shouldShowUnreadJump(true, 3)).toBe(false);
  });

  test("未読0件では表示しない", () => {
    expect(shouldShowUnreadJump(false, 0)).toBe(false);
  });

  test("最下部以外かつ未読1件以上で表示する", () => {
    expect(shouldShowUnreadJump(false, 1)).toBe(true);
    expect(shouldShowUnreadJump(false, 5)).toBe(true);
  });
});

describe("UnreadJumpButton", () => {
  test("表示条件を満たすときのみ導線を描画する", () => {
    const visibleHtml = renderToStaticMarkup(
      createElement(UnreadJumpButton, {
        isAtBottom: false,
        unreadCount: 2,
      })
    );
    const hiddenHtml = renderToStaticMarkup(
      createElement(UnreadJumpButton, {
        isAtBottom: true,
        unreadCount: 2,
      })
    );

    expect(visibleHtml).toContain("新着2件を表示");
    expect(hiddenHtml).toBe("");
  });
});
