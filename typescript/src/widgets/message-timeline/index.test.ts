/** @vitest-environment happy-dom */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, test } from "vitest";
import { MessageTimeline } from "./index";

describe("MessageTimeline", () => {
  test("同一送信者の5分以内連投を1つの送信者ヘッダーにまとめて表示する", () => {
    render(
      createElement(MessageTimeline, {
        messages: [
          {
            id: "m1",
            senderId: "alice",
            senderName: "Alice",
            body: "first",
            sentAt: "2025-01-01T10:00:00.000Z",
          },
          {
            id: "m2",
            senderId: "alice",
            senderName: "Alice",
            body: "second",
            sentAt: "2025-01-01T10:03:00.000Z",
          },
          {
            id: "m3",
            senderId: "bob",
            senderName: "Bob",
            body: "third",
            sentAt: "2025-01-01T10:06:00.000Z",
          },
        ],
      })
    );

    expect(screen.getAllByRole("heading", { level: 3, name: "Alice" })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 3, name: "Bob" })).toHaveLength(1);
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
    expect(screen.getByText("third")).toBeTruthy();
  });

  test("メッセージが空の場合は空状態ラベルを表示する", () => {
    render(createElement(MessageTimeline, { messages: [] }));

    expect(screen.getByText("メッセージはまだありません。")).toBeTruthy();
  });
});
