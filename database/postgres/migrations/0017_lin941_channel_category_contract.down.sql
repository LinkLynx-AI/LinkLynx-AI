CREATE OR REPLACE FUNCTION enforce_channel_hierarchies_v2_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  child_guild_id BIGINT;
  child_type TEXT;
  parent_guild_id BIGINT;
  parent_type TEXT;
BEGIN
  SELECT guild_id, type::text
  INTO child_guild_id, child_type
  FROM channels
  WHERE id = NEW.child_channel_id;

  IF child_guild_id IS NULL OR child_type <> 'guild_text' THEN
    RAISE EXCEPTION 'child channel must be guild_text with guild_id';
  END IF;

  SELECT guild_id, type::text
  INTO parent_guild_id, parent_type
  FROM channels
  WHERE id = NEW.parent_channel_id;

  IF parent_guild_id IS NULL OR parent_type <> 'guild_text' THEN
    RAISE EXCEPTION 'parent channel must be guild_text with guild_id';
  END IF;

  IF child_guild_id <> parent_guild_id OR child_guild_id <> NEW.guild_id THEN
    RAISE EXCEPTION 'hierarchy guild scope mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP INDEX IF EXISTS idx_channels_guild_created_id;

DROP INDEX IF EXISTS idx_channels_guild;

ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS chk_channels_guild_scoped_name_not_blank;

ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS chk_channels_shape_guild_category;

ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS chk_channels_shape_dm;

ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS chk_channels_shape_guild_text;

DELETE FROM channel_hierarchies_v2
WHERE parent_channel_id IN (
  SELECT id
  FROM channels
  WHERE type = 'guild_category'
);

DELETE FROM channels
WHERE type = 'guild_category';

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

ALTER TABLE channels
  ADD CONSTRAINT chk_channels_guild_text_name_not_blank
    CHECK (
      type <> 'guild_text'
      OR btrim(COALESCE(name, '')) <> ''
    );

CREATE INDEX idx_channels_guild_created_id
  ON channels (guild_id, created_at ASC, id ASC)
  WHERE type = 'guild_text';

CREATE INDEX idx_channels_guild
  ON channels (guild_id)
  WHERE type = 'guild_text';
