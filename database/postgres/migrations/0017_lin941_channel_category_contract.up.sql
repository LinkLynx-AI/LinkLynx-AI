ALTER TYPE channel_type
  ADD VALUE IF NOT EXISTS 'guild_category';

ALTER TABLE channels
  DROP CONSTRAINT IF EXISTS chk_channels_guild_text_name_not_blank;

ALTER TABLE channels
  ADD CONSTRAINT chk_channels_shape_guild_category
    CHECK (
      type <> 'guild_category'
      OR (guild_id IS NOT NULL AND name IS NOT NULL)
    );

ALTER TABLE channels
  ADD CONSTRAINT chk_channels_guild_scoped_name_not_blank
    CHECK (
      type NOT IN ('guild_text', 'guild_category')
      OR btrim(COALESCE(name, '')) <> ''
    );

DROP INDEX IF EXISTS idx_channels_guild;

CREATE INDEX idx_channels_guild
  ON channels (guild_id)
  WHERE type IN ('guild_text', 'guild_category');

DROP INDEX IF EXISTS idx_channels_guild_created_id;

CREATE INDEX idx_channels_guild_created_id
  ON channels (guild_id, created_at ASC, id ASC)
  WHERE type IN ('guild_text', 'guild_category');

CREATE OR REPLACE FUNCTION enforce_channel_hierarchies_v2_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  child_guild_id BIGINT;
  child_type channel_type;
  parent_guild_id BIGINT;
  parent_type channel_type;
BEGIN
  SELECT guild_id, type
  INTO child_guild_id, child_type
  FROM channels
  WHERE id = NEW.child_channel_id;

  IF child_guild_id IS NULL OR child_type <> 'guild_text' THEN
    RAISE EXCEPTION 'child channel must be guild_text with guild_id';
  END IF;

  SELECT guild_id, type
  INTO parent_guild_id, parent_type
  FROM channels
  WHERE id = NEW.parent_channel_id;

  IF parent_guild_id IS NULL THEN
    RAISE EXCEPTION 'parent channel must have guild_id';
  END IF;

  IF NEW.hierarchy_kind = 'category_child' AND parent_type <> 'guild_category' THEN
    RAISE EXCEPTION 'category_child parent must be guild_category';
  END IF;

  IF NEW.hierarchy_kind = 'thread' AND parent_type <> 'guild_text' THEN
    RAISE EXCEPTION 'thread parent must be guild_text';
  END IF;

  IF child_guild_id <> parent_guild_id OR child_guild_id <> NEW.guild_id THEN
    RAISE EXCEPTION 'hierarchy guild scope mismatch';
  END IF;

  RETURN NEW;
END;
$$;
