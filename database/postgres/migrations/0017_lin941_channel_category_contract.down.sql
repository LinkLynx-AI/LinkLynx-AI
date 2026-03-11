DELETE FROM channel_hierarchies_v2
WHERE parent_channel_id IN (
  SELECT id
  FROM channels
  WHERE type = 'guild_category'
);

DELETE FROM channels
WHERE type = 'guild_category';

ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS chk_channels_shape_dm;

ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS chk_channels_shape_guild_text;

ALTER TABLE channels
  ALTER COLUMN type TYPE text
  USING type::text;

DROP TYPE channel_type;

CREATE TYPE channel_type AS ENUM ('guild_text', 'dm');

ALTER TABLE channels
  ALTER COLUMN type TYPE channel_type
  USING type::channel_type;

ALTER TABLE channels
  ADD CONSTRAINT chk_channels_shape_dm
    CHECK (
      type <> 'dm'
      OR guild_id IS NULL
    );

ALTER TABLE channels
  ADD CONSTRAINT chk_channels_shape_guild_text
    CHECK (
      type <> 'guild_text'
      OR (guild_id IS NOT NULL AND name IS NOT NULL)
    );
