// Layout dimensions (px)
export const LAYOUT = {
  SERVER_LIST_WIDTH: 72,
  CHANNEL_SIDEBAR_WIDTH: 240,
  MEMBER_LIST_WIDTH: 240,
  HEADER_HEIGHT: 48,
  USER_PANEL_HEIGHT: 52,
  INPUT_HEIGHT: 44,
  SERVER_ICON_SIZE: 48,
} as const;

// Avatar sizes (px)
export const AVATAR_SIZE = {
  REPLY: 16,
  PANEL: 32,
  DM: 32,
  MESSAGE: 40,
  POPOUT: 80,
  PROFILE: 128,
} as const;

// Channel types (Discord API v10)
export const CHANNEL_TYPE = {
  GUILD_TEXT: 0,
  DM: 1,
  GUILD_VOICE: 2,
  GROUP_DM: 3,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  GUILD_STAGE_VOICE: 13,
  GUILD_FORUM: 15,
} as const;

// Message limits
export const MESSAGE_LIMIT = {
  CONTENT_LENGTH: 2000,
  EMBEDS_PER_MESSAGE: 10,
  REACTIONS_PER_MESSAGE: 20,
  FETCH_LIMIT: 50,
} as const;
