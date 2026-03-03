DROP TRIGGER IF EXISTS trg_enforce_channel_hierarchies_v2_scope ON channel_hierarchies_v2;
DROP FUNCTION IF EXISTS enforce_channel_hierarchies_v2_scope();

DROP INDEX IF EXISTS uq_channel_hierarchies_v2_thread_parent_message;
DROP INDEX IF EXISTS idx_channel_hierarchies_v2_guild_kind;
DROP INDEX IF EXISTS idx_channel_hierarchies_v2_parent_pos;

DROP TABLE IF EXISTS channel_hierarchies_v2;
DROP TYPE IF EXISTS channel_hierarchy_kind;
