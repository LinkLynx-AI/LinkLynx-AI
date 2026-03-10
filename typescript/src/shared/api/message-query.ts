"use client";

import type { InfiniteData } from "@tanstack/react-query";
import type { Message } from "@/shared/model/types";
import type { MessagePage } from "./api-client";

export const DEFAULT_MESSAGE_PAGE_LIMIT = 50;

export function buildMessagesQueryKey(guildId: string | null | undefined, channelId: string) {
  return ["messages", guildId ?? "dm", channelId] as const;
}

type MessagePagesData = InfiniteData<MessagePage, string | null>;

function isFallbackAuthor(message: Message): boolean {
  return (
    message.author.avatar === null &&
    message.author.status === "offline" &&
    message.author.username === `user-${message.author.id}` &&
    message.author.displayName === `User ${message.author.id}`
  );
}

function mergeMessages(current: Message, incoming: Message): Message {
  const nextAuthor =
    isFallbackAuthor(current) && !isFallbackAuthor(incoming) ? incoming.author : current.author;

  return {
    ...current,
    ...incoming,
    author: nextAuthor,
  };
}

function compareMessages(left: Message, right: Message): number {
  const timestampOrder = new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
  if (timestampOrder !== 0) {
    return timestampOrder;
  }

  return left.id.localeCompare(right.id, undefined, { numeric: true });
}

function dedupeMessages(items: ReadonlyArray<Message>): Message[] {
  const messageById = new Map<string, Message>();
  for (const item of items) {
    const current = messageById.get(item.id);
    messageById.set(item.id, current === undefined ? item : mergeMessages(current, item));
  }

  return [...messageById.values()].sort(compareMessages);
}

/**
 * paged message response 群を timeline 表示用に正規化する。
 */
export function flattenMessagePages(pages: ReadonlyArray<MessagePage>): Message[] {
  return dedupeMessages(pages.flatMap((page) => page.items));
}

/**
 * 単一 message を infinite query cache へ反映する。
 */
export function appendMessageToPages(
  current: MessagePagesData | undefined,
  message: Message,
): MessagePagesData {
  if (current === undefined || current.pages.length === 0) {
    return {
      pageParams: [null],
      pages: [
        {
          items: [message],
          nextBefore: null,
          nextAfter: null,
          hasMore: false,
        },
      ],
    };
  }

  let updatedExistingMessage = false;
  const nextPages = current.pages.map((page) => {
    const nextItems = page.items.map((item) => {
      if (item.id !== message.id) {
        return item;
      }

      updatedExistingMessage = true;
      return mergeMessages(item, message);
    });

    return {
      ...page,
      items: nextItems,
    };
  });

  if (updatedExistingMessage) {
    return {
      ...current,
      pages: nextPages,
    };
  }

  const [firstPage, ...restPages] = nextPages;

  return {
    ...current,
    pages: [
      {
        ...firstPage,
        items: [message, ...firstPage.items],
      },
      ...restPages,
    ],
  };
}
