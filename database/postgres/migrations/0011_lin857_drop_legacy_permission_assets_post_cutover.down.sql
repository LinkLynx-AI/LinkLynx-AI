CREATE TYPE role_level AS ENUM ('owner', 'admin', 'member');

CREATE TABLE guild_roles (
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  level role_level NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (guild_id, level)
);

CREATE TABLE guild_member_roles (
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  level role_level NOT NULL,

  PRIMARY KEY (guild_id, user_id),
  FOREIGN KEY (guild_id, user_id)
    REFERENCES guild_members(guild_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (guild_id, level)
    REFERENCES guild_roles(guild_id, level) ON DELETE RESTRICT
);

CREATE TABLE channel_permission_overrides (
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  level role_level NOT NULL,
  can_view BOOLEAN,
  can_post BOOLEAN,
  PRIMARY KEY (channel_id, level)
);

COMMENT ON COLUMN channel_permission_overrides.can_view
  IS 'NULL はロール既定値を継承、TRUE/FALSE は明示上書き。';
COMMENT ON COLUMN channel_permission_overrides.can_post
  IS 'NULL はロール既定値を継承、TRUE/FALSE は明示上書き。';

ALTER TABLE guild_roles_v2
ADD COLUMN source_level role_level;
