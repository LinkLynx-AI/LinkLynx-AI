import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import type { MessagePage } from "./api-client";
import { appendMessageToPages } from "./message-query";

describe("message-query", () => {
  test("appendMessageToPages merges duplicate message and prefers hydrated author", () => {
    const existingMessage = {
      id: "5001",
      channelId: "3001",
      author: {
        id: "9003",
        username: "user-9003",
        displayName: "User 9003",
        avatar: null,
        status: "offline",
        customStatus: null,
        bot: false,
      },
      content: "hello",
      timestamp: "2026-03-10T10:00:00Z",
      editedTimestamp: null,
      type: 0,
      pinned: false,
      mentionEveryone: false,
      mentions: [],
      attachments: [],
      embeds: [],
      reactions: [],
      referencedMessage: null,
    } satisfies MessagePage["items"][number];
    const current: InfiniteData<MessagePage, string | null> = {
      pageParams: [null],
      pages: [
        {
          items: [existingMessage],
          nextBefore: null,
          nextAfter: null,
          hasMore: false,
        },
      ],
    };

    const next = appendMessageToPages(current, {
      ...existingMessage,
      author: {
        id: "9003",
        username: "alice",
        displayName: "Alice",
        avatar: null,
        status: "online",
        customStatus: null,
        bot: false,
      },
    });

    expect(next.pages[0]?.items[0]?.author.displayName).toBe("Alice");
  });
});
