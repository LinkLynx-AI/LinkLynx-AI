DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS channel_last_message;
DROP TABLE IF EXISTS channel_reads;
DROP TABLE IF EXISTS channel_permission_overrides;
DROP TABLE IF EXISTS guild_member_roles;
DROP TABLE IF EXISTS guild_roles;

DROP TYPE IF EXISTS outbox_status;
DROP TYPE IF EXISTS audit_action;
DROP TYPE IF EXISTS role_level;
