CREATE SEQUENCE IF NOT EXISTS guilds_id_seq;

SELECT setval(
  'guilds_id_seq',
  COALESCE((SELECT MAX(id) FROM guilds), 1),
  EXISTS(SELECT 1 FROM guilds)
);

ALTER TABLE guilds
  ALTER COLUMN id SET DEFAULT nextval('guilds_id_seq');

ALTER SEQUENCE guilds_id_seq OWNED BY guilds.id;

CREATE SEQUENCE IF NOT EXISTS channels_id_seq;

SELECT setval(
  'channels_id_seq',
  COALESCE((SELECT MAX(id) FROM channels), 1),
  EXISTS(SELECT 1 FROM channels)
);

ALTER TABLE channels
  ALTER COLUMN id SET DEFAULT nextval('channels_id_seq');

ALTER SEQUENCE channels_id_seq OWNED BY channels.id;

ALTER TABLE guilds
  ADD CONSTRAINT chk_guilds_name_not_blank
    CHECK (btrim(name) <> '');

ALTER TABLE channels
  ADD CONSTRAINT chk_channels_guild_text_name_not_blank
    CHECK (
      type <> 'guild_text'
      OR btrim(COALESCE(name, '')) <> ''
    );

CREATE INDEX idx_guild_members_user_joined_guild
  ON guild_members (user_id, joined_at DESC, guild_id);

CREATE INDEX idx_channels_guild_created_id
  ON channels (guild_id, created_at ASC, id ASC)
  WHERE type = 'guild_text';
