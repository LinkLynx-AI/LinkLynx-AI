CREATE TYPE channel_type AS ENUM ('guild_text', 'dm');

CREATE TABLE guilds (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  icon_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guild_members (
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nickname TEXT,
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX idx_guild_members_user
  ON guild_members (user_id);

CREATE TABLE invites (
  id BIGINT PRIMARY KEY,
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  max_uses INT,
  uses INT NOT NULL DEFAULT 0,
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_invites_uses_non_negative CHECK (uses >= 0),
  CONSTRAINT chk_invites_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT chk_invites_uses_lte_max CHECK (max_uses IS NULL OR uses <= max_uses)
);

CREATE INDEX idx_invites_guild
  ON invites (guild_id);

CREATE INDEX idx_invites_expires
  ON invites (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE invite_uses (
  invite_id BIGINT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  used_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (invite_id, used_by)
);

CREATE TABLE channels (
  id BIGINT PRIMARY KEY,
  type channel_type NOT NULL,

  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  name TEXT,

  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_channels_shape_guild_text
    CHECK (
      type <> 'guild_text'
      OR (guild_id IS NOT NULL AND name IS NOT NULL)
    ),
  CONSTRAINT chk_channels_shape_dm
    CHECK (
      type <> 'dm'
      OR guild_id IS NULL
    )
);

CREATE INDEX idx_channels_guild
  ON channels (guild_id)
  WHERE type = 'guild_text';

CREATE TABLE dm_participants (
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX idx_dm_participants_user
  ON dm_participants (user_id);

CREATE TABLE dm_pairs (
  user_low BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,

  PRIMARY KEY (user_low, user_high),
  CONSTRAINT chk_dm_pairs_order CHECK (user_low < user_high),
  CONSTRAINT uq_dm_pairs_channel UNIQUE (channel_id)
);

CREATE OR REPLACE FUNCTION enforce_dm_pairs_channel_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM channels c
    WHERE c.id = NEW.channel_id
      AND c.type = 'dm'
  ) THEN
    RAISE EXCEPTION 'dm_pairs.channel_id must reference channels.type=dm';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_dm_pairs_channel_type
BEFORE INSERT OR UPDATE ON dm_pairs
FOR EACH ROW
EXECUTE FUNCTION enforce_dm_pairs_channel_type();
