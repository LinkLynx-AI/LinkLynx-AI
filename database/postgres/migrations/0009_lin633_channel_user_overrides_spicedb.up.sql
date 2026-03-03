CREATE TABLE channel_user_permission_overrides_v2 (
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  can_view BOOLEAN,
  can_post BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (channel_id, user_id),
  FOREIGN KEY (guild_id, user_id)
    REFERENCES guild_members(guild_id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_channel_user_overrides_v2_user
  ON channel_user_permission_overrides_v2 (user_id, guild_id);

COMMENT ON COLUMN channel_user_permission_overrides_v2.can_view
  IS 'NULL はロール既定値を継承、TRUE/FALSE はユーザー単位で明示上書き。';
COMMENT ON COLUMN channel_user_permission_overrides_v2.can_post
  IS 'NULL はロール既定値を継承、TRUE/FALSE はユーザー単位で明示上書き。';

CREATE OR REPLACE FUNCTION enforce_channel_user_overrides_v2_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  channel_guild_id BIGINT;
BEGIN
  SELECT guild_id
  INTO channel_guild_id
  FROM channels
  WHERE id = NEW.channel_id;

  IF channel_guild_id IS NULL THEN
    RAISE EXCEPTION 'channel_user_permission_overrides_v2.channel_id must reference guild channel';
  END IF;

  IF channel_guild_id <> NEW.guild_id THEN
    RAISE EXCEPTION 'channel_user_permission_overrides_v2.guild_id must match channels.guild_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_channel_user_overrides_v2_scope
BEFORE INSERT OR UPDATE ON channel_user_permission_overrides_v2
FOR EACH ROW
EXECUTE FUNCTION enforce_channel_user_overrides_v2_scope();

CREATE OR REPLACE VIEW channel_permission_overrides_subject_v2 AS
SELECT
  channel_id,
  guild_id,
  'role'::text AS subject_type,
  role_key AS subject_id,
  can_view,
  can_post,
  created_at,
  updated_at
FROM channel_role_permission_overrides_v2
UNION ALL
SELECT
  channel_id,
  guild_id,
  'user'::text AS subject_type,
  user_id::text AS subject_id,
  can_view,
  can_post,
  created_at,
  updated_at
FROM channel_user_permission_overrides_v2;
