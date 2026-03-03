DROP INDEX IF EXISTS idx_channels_guild_created_id;
DROP INDEX IF EXISTS idx_guild_members_user_joined_guild;

ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS chk_channels_guild_text_name_not_blank;

ALTER TABLE guilds
  DROP CONSTRAINT IF EXISTS chk_guilds_name_not_blank;

ALTER TABLE channels
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE guilds
  ALTER COLUMN id DROP DEFAULT;

DROP SEQUENCE IF EXISTS channels_id_seq;
DROP SEQUENCE IF EXISTS guilds_id_seq;
