DROP TRIGGER IF EXISTS trg_enforce_channel_role_overrides_v2_scope ON channel_role_permission_overrides_v2;
DROP FUNCTION IF EXISTS enforce_channel_role_overrides_v2_scope();

DROP TABLE IF EXISTS channel_role_permission_overrides_v2;

DROP INDEX IF EXISTS idx_guild_member_roles_v2_user;
DROP TABLE IF EXISTS guild_member_roles_v2;

DROP INDEX IF EXISTS idx_guild_roles_v2_priority;
DROP TABLE IF EXISTS guild_roles_v2;
