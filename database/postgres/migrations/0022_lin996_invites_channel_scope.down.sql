DROP INDEX IF EXISTS idx_invites_guild_channel;

ALTER TABLE invites
  DROP COLUMN IF EXISTS channel_id;
