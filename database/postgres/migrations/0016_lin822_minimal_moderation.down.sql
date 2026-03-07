DROP INDEX IF EXISTS idx_moderation_mutes_expires_at;
DROP INDEX IF EXISTS idx_moderation_mutes_guild_created;

DROP TABLE IF EXISTS moderation_mutes;
DROP SEQUENCE IF EXISTS moderation_mutes_id_seq;

DROP INDEX IF EXISTS idx_moderation_reports_guild_created;
DROP INDEX IF EXISTS idx_moderation_reports_guild_status_created;

DROP TABLE IF EXISTS moderation_reports;
DROP SEQUENCE IF EXISTS moderation_reports_id_seq;

DROP TYPE IF EXISTS moderation_report_status;

ALTER TABLE audit_logs
  ALTER COLUMN id DROP DEFAULT;

DROP SEQUENCE IF EXISTS audit_logs_id_seq;

-- NOTE:
-- enum values added to audit_action in the up migration are intentionally retained.
-- PostgreSQL does not support DROP VALUE on enum in a backward-compatible way.
