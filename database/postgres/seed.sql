-- LinkLynx 開発用 PostgreSQL seed
-- 再実行可能（ON CONFLICT）を前提にしている

BEGIN;

-- users
INSERT INTO users (id, email, display_name, theme, status_text)
VALUES
  (1001, 'alice@example.com', 'Alice', 'dark',  'Building LinkLynx'),
  (1002, 'bob@example.com',   'Bob',   'light', 'Reviewing PRs'),
  (1003, 'carol@example.com', 'Carol', 'dark',  'Designing channels'),
  (1004, 'dave@example.com',  'Dave',  'light', 'Testing invites')
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  theme = EXCLUDED.theme,
  status_text = EXCLUDED.status_text;

-- guilds / members / roles
INSERT INTO guilds (id, name, owner_id)
VALUES (2001, 'LinkLynx Developers', 1001)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  owner_id = EXCLUDED.owner_id;

INSERT INTO guild_members (guild_id, user_id, nickname)
VALUES
  (2001, 1001, 'alice-owner'),
  (2001, 1002, 'bob-admin'),
  (2001, 1003, 'carol-member')
ON CONFLICT (guild_id, user_id) DO UPDATE
SET
  nickname = EXCLUDED.nickname;

INSERT INTO guild_roles_v2 (guild_id, role_key, name, priority, allow_view, allow_post, allow_manage, is_system)
VALUES
  (2001, 'owner',  'Owner', 300, true, true, true, true),
  (2001, 'admin',  'Admin', 200, true, true, true, true),
  (2001, 'member', 'Member', 100, true, true, false, true)
ON CONFLICT (guild_id, role_key) DO UPDATE
SET
  name = EXCLUDED.name,
  priority = EXCLUDED.priority,
  allow_view = EXCLUDED.allow_view,
  allow_post = EXCLUDED.allow_post,
  allow_manage = EXCLUDED.allow_manage,
  is_system = EXCLUDED.is_system;

INSERT INTO guild_member_roles_v2 (guild_id, user_id, role_key)
VALUES
  (2001, 1001, 'owner'),
  (2001, 1002, 'admin'),
  (2001, 1003, 'member')
ON CONFLICT (guild_id, user_id, role_key) DO NOTHING;

INSERT INTO channels (id, type, guild_id, name, created_by)
VALUES
  (3001, 'guild_text', 2001, 'general', 1001),
  (3002, 'guild_text', 2001, 'random', 1001),
  (3101, 'dm', NULL, NULL, 1001),
  (3102, 'dm', NULL, NULL, 1002)
ON CONFLICT (id) DO UPDATE
SET
  type = EXCLUDED.type,
  guild_id = EXCLUDED.guild_id,
  name = EXCLUDED.name,
  created_by = EXCLUDED.created_by;

INSERT INTO channel_role_permission_overrides_v2 (channel_id, guild_id, role_key, can_view, can_post)
VALUES
  (3001, 2001, 'member', true, true),
  (3002, 2001, 'member', true, false),
  (3002, 2001, 'admin', true, true)
ON CONFLICT (channel_id, role_key) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_post = EXCLUDED.can_post;

INSERT INTO dm_participants (channel_id, user_id)
VALUES
  (3101, 1001),
  (3101, 1002),
  (3102, 1002),
  (3102, 1003)
ON CONFLICT (channel_id, user_id) DO NOTHING;

INSERT INTO dm_pairs (user_low, user_high, channel_id)
VALUES
  (1001, 1002, 3101),
  (1002, 1003, 3102)
ON CONFLICT (user_low, user_high) DO UPDATE
SET
  channel_id = EXCLUDED.channel_id;

INSERT INTO channel_reads (channel_id, user_id, last_read_message_id, last_client_seq)
VALUES
  (3001, 1001, 9000001, 10),
  (3001, 1002, 9000000, 9),
  (3101, 1001, 9100000, 3),
  (3101, 1002, 9100000, 4)
ON CONFLICT (channel_id, user_id) DO UPDATE
SET
  last_read_message_id = EXCLUDED.last_read_message_id,
  last_client_seq = EXCLUDED.last_client_seq,
  updated_at = now();

INSERT INTO channel_last_message (channel_id, last_message_id, last_message_at)
VALUES
  (3001, 9000001, now() - interval '2 minutes'),
  (3002, 9000002, now() - interval '5 minutes'),
  (3101, 9100000, now() - interval '1 minute')
ON CONFLICT (channel_id) DO UPDATE
SET
  last_message_id = EXCLUDED.last_message_id,
  last_message_at = EXCLUDED.last_message_at,
  updated_at = now();

-- invites
INSERT INTO invites (id, guild_id, created_by, code, expires_at, max_uses, uses, is_disabled)
VALUES
  (4001, 2001, 1001, 'DEVJOIN2026', now() + interval '14 days', 100, 2, false),
  (4002, 2001, 1001, 'TEMP2026', now() + interval '1 day', 10, 0, false)
ON CONFLICT (id) DO UPDATE
SET
  guild_id = EXCLUDED.guild_id,
  created_by = EXCLUDED.created_by,
  code = EXCLUDED.code,
  expires_at = EXCLUDED.expires_at,
  max_uses = EXCLUDED.max_uses,
  uses = EXCLUDED.uses,
  is_disabled = EXCLUDED.is_disabled;

INSERT INTO invite_uses (invite_id, used_by)
VALUES
  (4001, 1003),
  (4001, 1004)
ON CONFLICT (invite_id, used_by) DO NOTHING;

-- audit / outbox
INSERT INTO audit_logs (id, guild_id, actor_id, action, target_type, target_id, metadata)
VALUES
  (5001, 2001, 1001, 'CHANNEL_CREATE', 'channel', 3002, '{"name":"random"}'::jsonb),
  (5002, 2001, 1001, 'INVITE_CREATE', 'invite', 4001, '{"code":"DEVJOIN2026","channel_id":3001}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET
  guild_id = EXCLUDED.guild_id,
  actor_id = EXCLUDED.actor_id,
  action = EXCLUDED.action,
  target_type = EXCLUDED.target_type,
  target_id = EXCLUDED.target_id,
  metadata = EXCLUDED.metadata;

INSERT INTO outbox_events (id, event_type, aggregate_id, payload, status, attempts, next_retry_at)
VALUES
  (
    6001,
    'guild.member.joined',
    'guild:2001',
    '{"guildId":2001,"userId":1003}'::jsonb,
    'PENDING',
    0,
    NULL
  ),
  (
    6002,
    'message.posted',
    'channel:3001',
    '{"channelId":3001,"messageId":9000001}'::jsonb,
    'FAILED',
    1,
    now() - interval '1 minute'
  )
ON CONFLICT (id) DO UPDATE
SET
  event_type = EXCLUDED.event_type,
  aggregate_id = EXCLUDED.aggregate_id,
  payload = EXCLUDED.payload,
  status = EXCLUDED.status,
  attempts = EXCLUDED.attempts,
  next_retry_at = EXCLUDED.next_retry_at,
  updated_at = now();

COMMIT;
