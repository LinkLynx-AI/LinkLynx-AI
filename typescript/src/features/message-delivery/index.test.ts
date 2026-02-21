import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  MessageDeliveryStatus,
  getMessageDeliveryMeta,
  shouldShowRetryAction,
} from "@/features/message-delivery";

describe("getMessageDeliveryMeta", () => {
  test("state ごとの表示ラベルを返す", () => {
    expect(getMessageDeliveryMeta("pending").label).toBe("送信中");
    expect(getMessageDeliveryMeta("sent").label).toBe("送信済み");
    expect(getMessageDeliveryMeta("failed").label).toBe("送信失敗");
  });
});

describe("shouldShowRetryAction", () => {
  test("failed のときのみ true を返す", () => {
    expect(shouldShowRetryAction("pending")).toBe(false);
    expect(shouldShowRetryAction("sent")).toBe(false);
    expect(shouldShowRetryAction("failed")).toBe(true);
  });
});

describe("MessageDeliveryStatus", () => {
  test("failed のときに再送導線を表示する", () => {
    const html = renderToStaticMarkup(
      createElement(MessageDeliveryStatus, { state: "failed" })
    );

    expect(html).toContain("送信失敗");
    expect(html).toContain("再送");
  });

  test("failed 以外では再送導線を表示しない", () => {
    const pendingHtml = renderToStaticMarkup(
      createElement(MessageDeliveryStatus, { state: "pending" })
    );
    const sentHtml = renderToStaticMarkup(
      createElement(MessageDeliveryStatus, { state: "sent" })
    );

    expect(pendingHtml).not.toContain("再送");
    expect(sentHtml).not.toContain("再送");
  });
});
