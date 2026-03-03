CREATE TABLE guild_roles_v2 (
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  name TEXT NOT NULL,
  priority INT NOT NULL,
  allow_view BOOLEAN NOT NULL DEFAULT TRUE,
  allow_post BOOLEAN NOT NULL DEFAULT TRUE,
  allow_manage BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_level role_level,

  PRIMARY KEY (guild_id, role_key),
  CONSTRAINT chk_guild_roles_v2_role_key_non_empty CHECK (length(role_key) > 0),
  CONSTRAINT chk_guild_roles_v2_name_non_empty CHECK (length(name) > 0)
);

CREATE INDEX idx_guild_roles_v2_priority
  ON guild_roles_v2 (guild_id, priority DESC, role_key);

CREATE TABLE guild_member_roles_v2 (
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role_key TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,

  PRIMARY KEY (guild_id, user_id, role_key),
  FOREIGN KEY (guild_id, user_id)
    REFERENCES guild_members(guild_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (guild_id, role_key)
    REFERENCES guild_roles_v2(guild_id, role_key) ON DELETE RESTRICT
);

CREATE INDEX idx_guild_member_roles_v2_user
  ON guild_member_roles_v2 (user_id, guild_id);

CREATE TABLE channel_role_permission_overrides_v2 (
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  guild_id BIGINT NOT NULL,
  role_key TEXT NOT NULL,
  can_view BOOLEAN,
  can_post BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (channel_id, role_key),
  FOREIGN KEY (guild_id, role_key)
    REFERENCES guild_roles_v2(guild_id, role_key) ON DELETE CASCADE,
  CONSTRAINT chk_channel_role_overrides_v2_role_key_non_empty CHECK (length(role_key) > 0)
);

COMMENT ON COLUMN channel_role_permission_overrides_v2.can_view
  IS 'NULL はロール既定値を継承、TRUE/FALSE は明示上書き。';
COMMENT ON COLUMN channel_role_permission_overrides_v2.can_post
  IS 'NULL はロール既定値を継承、TRUE/FALSE は明示上書き。';

CREATE OR REPLACE FUNCTION enforce_channel_role_overrides_v2_scope()
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
    RAISE EXCEPTION 'channel_role_permission_overrides_v2.channel_id must reference guild channel';
  END IF;

  IF channel_guild_id <> NEW.guild_id THEN
    RAISE EXCEPTION 'channel_role_permission_overrides_v2.guild_id must match channels.guild_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_channel_role_overrides_v2_scope
BEFORE INSERT OR UPDATE ON channel_role_permission_overrides_v2
FOR EACH ROW
EXECUTE FUNCTION enforce_channel_role_overrides_v2_scope();

INSERT INTO guild_roles_v2 (
  guild_id,
  role_key,
  name,
  priority,
  allow_view,
  allow_post,
  allow_manage,
  is_system,
  source_level
)
SELECT
  guild_id,
  level::text AS role_key,
  name,
  CASE level
    WHEN 'owner' THEN 300
    WHEN 'admin' THEN 200
    ELSE 100
  END AS priority,
  TRUE AS allow_view,
  TRUE AS allow_post,
  CASE level
    WHEN 'member' THEN FALSE
    ELSE TRUE
  END AS allow_manage,
  TRUE AS is_system,
  level AS source_level
FROM guild_roles;

INSERT INTO guild_member_roles_v2 (
  guild_id,
  user_id,
  role_key
)
SELECT
  guild_id,
  user_id,
  level::text AS role_key
FROM guild_member_roles;

INSERT INTO channel_role_permission_overrides_v2 (
  channel_id,
  guild_id,
  role_key,
  can_view,
  can_post
)
SELECT
  cpo.channel_id,
  c.guild_id,
  cpo.level::text AS role_key,
  cpo.can_view,
  cpo.can_post
FROM channel_permission_overrides cpo
JOIN channels c
  ON c.id = cpo.channel_id
WHERE c.guild_id IS NOT NULL;
