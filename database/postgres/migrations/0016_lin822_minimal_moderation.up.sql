CREATE TYPE moderation_report_status AS ENUM ('open', 'resolved');

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'REPORT_CREATE';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'MUTE_CREATE';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'REPORT_RESOLVE';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'REPORT_REOPEN';

CREATE SEQUENCE IF NOT EXISTS audit_logs_id_seq;

ALTER TABLE audit_logs
  ALTER COLUMN id SET DEFAULT nextval('audit_logs_id_seq');

ALTER SEQUENCE audit_logs_id_seq OWNED BY audit_logs.id;

SELECT setval(
  'audit_logs_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM audit_logs), 0), 1),
  COALESCE((SELECT MAX(id) FROM audit_logs), 0) > 0
);

CREATE SEQUENCE IF NOT EXISTS moderation_reports_id_seq;

CREATE TABLE moderation_reports (
  id BIGINT PRIMARY KEY DEFAULT nextval('moderation_reports_id_seq'),
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL,
  target_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  status moderation_report_status NOT NULL DEFAULT 'open',
  resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_moderation_reports_target_type
    CHECK (target_type IN ('message', 'user')),
  CONSTRAINT chk_moderation_reports_reason_non_blank
    CHECK (btrim(reason) <> ''),
  CONSTRAINT chk_moderation_reports_resolution_consistency
    CHECK (
      (status = 'open' AND resolved_by IS NULL AND resolved_at IS NULL)
      OR
      (status = 'resolved' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
    )
);

ALTER SEQUENCE moderation_reports_id_seq OWNED BY moderation_reports.id;

CREATE INDEX idx_moderation_reports_guild_status_created
  ON moderation_reports (guild_id, status, created_at DESC, id DESC);

CREATE INDEX idx_moderation_reports_guild_created
  ON moderation_reports (guild_id, created_at DESC, id DESC);

CREATE SEQUENCE IF NOT EXISTS moderation_mutes_id_seq;

CREATE TABLE moderation_mutes (
  id BIGINT PRIMARY KEY DEFAULT nextval('moderation_mutes_id_seq'),
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  target_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_moderation_mutes_reason_non_blank
    CHECK (btrim(reason) <> ''),
  CONSTRAINT uq_moderation_mutes_guild_target
    UNIQUE (guild_id, target_user_id)
);

ALTER SEQUENCE moderation_mutes_id_seq OWNED BY moderation_mutes.id;

CREATE INDEX idx_moderation_mutes_guild_created
  ON moderation_mutes (guild_id, created_at DESC, id DESC);

CREATE INDEX idx_moderation_mutes_expires_at
  ON moderation_mutes (expires_at)
  WHERE expires_at IS NOT NULL;
