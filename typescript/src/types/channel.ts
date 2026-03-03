import type { User } from "./user";

export type ChannelType =
  | 0 // GUILD_TEXT
  | 1 // DM
  | 2 // GUILD_VOICE
  | 3 // GROUP_DM
  | 4 // GUILD_CATEGORY
  | 5 // GUILD_ANNOUNCEMENT
  | 13 // GUILD_STAGE_VOICE
  | 15; // GUILD_FORUM

export interface PermissionOverwrite {
  id: string;
  type: "role" | "member";
  allow: number;
  deny: number;
}

export interface Channel {
  id: string;
  type: ChannelType;
  guildId?: string;
  name: string;
  topic: string | null;
  position: number;
  parentId: string | null;
  nsfw: boolean;
  rateLimitPerUser: number;
  recipients?: User[];
  icon?: string | null;
  lastMessageId: string | null;
  slowModeInterval?: number;
  permissionOverwrites?: PermissionOverwrite[];
}

export interface ChannelCategory {
  id: string;
  name: string;
  position: number;
  channels: Channel[];
}
