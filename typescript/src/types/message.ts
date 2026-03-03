import type { User } from "./user";
import type { ActionRow } from "./bot-components";

export type MessageType =
  | 0 // DEFAULT
  | 1 // RECIPIENT_ADD
  | 2 // RECIPIENT_REMOVE
  | 3 // CALL
  | 4 // CHANNEL_NAME_CHANGE
  | 5 // CHANNEL_ICON_CHANGE
  | 6 // CHANNEL_PINNED_MESSAGE
  | 7 // USER_JOIN
  | 8 // GUILD_BOOST
  | 9 // GUILD_BOOST_TIER_1
  | 10 // GUILD_BOOST_TIER_2
  | 11 // GUILD_BOOST_TIER_3
  | 19 // REPLY
  | 20 // CHAT_INPUT_COMMAND
  | 21; // THREAD_STARTER_MESSAGE

export interface Message {
  id: string;
  channelId: string;
  author: User;
  content: string;
  timestamp: string;
  editedTimestamp: string | null;
  type: MessageType;
  pinned: boolean;
  mentionEveryone: boolean;
  mentions: User[];
  attachments: Attachment[];
  embeds: Embed[];
  reactions: Reaction[];
  referencedMessage: Message | null;
  components?: ActionRow[];
  flags?: number;
}

export interface Attachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxyUrl: string;
  contentType: string | null;
  width: number | null;
  height: number | null;
  spoiler: boolean;
}

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  thumbnail?: EmbedMedia;
  image?: EmbedMedia;
  author?: {
    name: string;
    url?: string;
    iconUrl?: string;
  };
  footer?: {
    text: string;
    iconUrl?: string;
  };
  fields?: EmbedField[];
  timestamp?: string;
}

export interface EmbedMedia {
  url: string;
  width?: number;
  height?: number;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Reaction {
  emoji: ReactionEmoji;
  count: number;
  me: boolean;
}

export interface ReactionEmoji {
  id: string | null;
  name: string;
  animated: boolean;
}

export interface CreateMessageData {
  content: string;
  referencedMessageId?: string;
  attachments?: File[];
}

export interface EditMessageData {
  content: string;
}
