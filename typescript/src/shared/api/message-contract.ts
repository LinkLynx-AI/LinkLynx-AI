import { z } from "zod";
import { isStrictDecimalString, parseJsonWithExactDecimalFields } from "@/shared/lib/exact-json";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { Message, User } from "@/shared/model/types";
import type { MessagePage } from "./api-client";

const MESSAGE_DECIMAL_ID_SCHEMA = z.string().refine((value) => {
  return isStrictDecimalString(value) && value !== "0";
}, "expected positive decimal string");
const MESSAGE_VERSION_SCHEMA = z.string().refine((value) => {
  return isStrictDecimalString(value) && value !== "0";
}, "expected positive decimal string");
const MESSAGE_EXACT_DECIMAL_FIELDS = [
  "message_id",
  "guild_id",
  "channel_id",
  "author_id",
  "version",
] as const;

export const MESSAGE_ITEM_SCHEMA = z.object({
  message_id: MESSAGE_DECIMAL_ID_SCHEMA,
  guild_id: MESSAGE_DECIMAL_ID_SCHEMA,
  channel_id: MESSAGE_DECIMAL_ID_SCHEMA,
  author_id: MESSAGE_DECIMAL_ID_SCHEMA,
  content: z.string(),
  created_at: z.string().trim().min(1),
  version: MESSAGE_VERSION_SCHEMA,
  edited_at: z.string().trim().min(1).nullable().optional(),
  is_deleted: z.boolean().optional(),
});

export const MESSAGE_LIST_RESPONSE_SCHEMA = z.object({
  items: z.array(MESSAGE_ITEM_SCHEMA),
  next_before: z.string().trim().min(1).nullable(),
  next_after: z.string().trim().min(1).nullable(),
  has_more: z.boolean(),
});

export const MESSAGE_CREATE_RESPONSE_SCHEMA = z.object({
  message: MESSAGE_ITEM_SCHEMA,
});

export type MessageItemApi = z.infer<typeof MESSAGE_ITEM_SCHEMA>;
export type MessageListResponseApi = z.infer<typeof MESSAGE_LIST_RESPONSE_SCHEMA>;

export function parseMessagePayload(rawText: string): unknown {
  return parseJsonWithExactDecimalFields(rawText, MESSAGE_EXACT_DECIMAL_FIELDS);
}

function buildFallbackAuthor(authorId: string): User {
  const currentUser = useAuthStore.getState().currentUser;
  const currentPrincipalId = useAuthStore.getState().currentPrincipalId;
  if (currentUser !== null && (currentPrincipalId === authorId || currentUser.id === authorId)) {
    if (currentPrincipalId !== null && currentUser.id !== currentPrincipalId) {
      return {
        ...currentUser,
        id: currentPrincipalId,
      };
    }

    return currentUser;
  }

  return {
    id: authorId,
    username: `user-${authorId}`,
    displayName: `User ${authorId}`,
    avatar: null,
    status: "offline",
    customStatus: null,
    bot: false,
  };
}

/**
 * backend message snapshot を frontend 表示型へ変換する。
 */
export function mapMessageItem(item: MessageItemApi): Message {
  return {
    id: String(item.message_id),
    channelId: String(item.channel_id),
    author: buildFallbackAuthor(String(item.author_id)),
    content: item.content,
    timestamp: item.created_at,
    editedTimestamp: item.edited_at ?? null,
    type: 0,
    pinned: false,
    mentionEveryone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    referencedMessage: null,
  };
}

/**
 * backend paged message response を frontend timeline page へ変換する。
 */
export function mapMessagePage(response: MessageListResponseApi): MessagePage {
  return {
    items: response.items.map(mapMessageItem),
    nextBefore: response.next_before,
    nextAfter: response.next_after,
    hasMore: response.has_more,
  };
}
