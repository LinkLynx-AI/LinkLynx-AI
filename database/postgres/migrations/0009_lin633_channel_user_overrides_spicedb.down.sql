DROP VIEW IF EXISTS channel_permission_overrides_subject_v2;

DROP TRIGGER IF EXISTS trg_enforce_channel_user_overrides_v2_scope ON channel_user_permission_overrides_v2;
DROP FUNCTION IF EXISTS enforce_channel_user_overrides_v2_scope();

DROP INDEX IF EXISTS idx_channel_user_overrides_v2_guild_user;
DROP INDEX IF EXISTS idx_channel_user_overrides_v2_user;
DROP TABLE IF EXISTS channel_user_permission_overrides_v2;
