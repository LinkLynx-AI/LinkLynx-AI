ALTER TABLE guild_roles_v2
DROP COLUMN source_level;

DROP TABLE IF EXISTS channel_permission_overrides;
DROP TABLE IF EXISTS guild_member_roles;
DROP TABLE IF EXISTS guild_roles;

DROP TYPE IF EXISTS role_level;
