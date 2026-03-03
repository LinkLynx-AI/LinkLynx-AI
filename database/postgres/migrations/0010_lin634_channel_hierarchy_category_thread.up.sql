CREATE TYPE channel_hierarchy_kind AS ENUM (
  'category_child',
  'thread'
);

CREATE TABLE channel_hierarchies_v2 (
  child_channel_id BIGINT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  parent_channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  hierarchy_kind channel_hierarchy_kind NOT NULL,
  parent_message_id BIGINT,
  position INT NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_channel_hierarchies_v2_position_non_negative CHECK (position >= 0),
  CONSTRAINT chk_channel_hierarchies_v2_not_self CHECK (child_channel_id <> parent_channel_id),
  CONSTRAINT chk_ch_hier_v2_thread_parent_msg CHECK (
    (hierarchy_kind = 'thread' AND parent_message_id IS NOT NULL)
    OR (hierarchy_kind = 'category_child' AND parent_message_id IS NULL)
  )
);

CREATE INDEX idx_channel_hierarchies_v2_parent_pos
  ON channel_hierarchies_v2 (parent_channel_id, position, child_channel_id);

CREATE INDEX idx_channel_hierarchies_v2_guild_kind
  ON channel_hierarchies_v2 (guild_id, hierarchy_kind, parent_channel_id);

CREATE UNIQUE INDEX uq_channel_hierarchies_v2_thread_parent_message
  ON channel_hierarchies_v2 (guild_id, parent_channel_id, parent_message_id)
  WHERE hierarchy_kind = 'thread';

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

  IF parent_guild_id IS NULL OR parent_type <> 'guild_text' THEN
    RAISE EXCEPTION 'parent channel must be guild_text with guild_id';
  END IF;

  IF child_guild_id <> parent_guild_id OR child_guild_id <> NEW.guild_id THEN
    RAISE EXCEPTION 'hierarchy guild scope mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_channel_hierarchies_v2_scope
BEFORE INSERT OR UPDATE ON channel_hierarchies_v2
FOR EACH ROW
EXECUTE FUNCTION enforce_channel_hierarchies_v2_scope();
