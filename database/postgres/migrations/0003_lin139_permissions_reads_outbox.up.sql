CREATE TYPE role_level AS ENUM ('owner', 'admin', 'member');

CREATE TYPE audit_action AS ENUM (
  'INVITE_CREATE', 'INVITE_DISABLE',
  'GUILD_MEMBER_JOIN', 'GUILD_MEMBER_LEAVE',
  'ROLE_ASSIGN', 'ROLE_REVOKE',
  'CHANNEL_CREATE', 'CHANNEL_UPDATE', 'CHANNEL_DELETE',
  'MESSAGE_DELETE_MOD', 'USER_BAN', 'USER_UNBAN'
);

CREATE TYPE outbox_status AS ENUM ('PENDING', 'SENT', 'FAILED');

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

CREATE TABLE channel_reads (
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_message_id BIGINT,
  last_client_seq BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX idx_channel_reads_user
  ON channel_reads (user_id);

CREATE TABLE channel_last_message (
  channel_id BIGINT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  last_message_id BIGINT NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_last_message_time
  ON channel_last_message (last_message_at DESC);

CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY,
  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES users(id),
  action audit_action NOT NULL,
  target_type TEXT,
  target_id BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_guild_time
  ON audit_logs (guild_id, created_at DESC);

CREATE TABLE outbox_events (
  id BIGINT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status outbox_status NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_outbox_attempts_non_negative CHECK (attempts >= 0)
);

CREATE INDEX idx_outbox_pending
  ON outbox_events (status, next_retry_at, created_at);
