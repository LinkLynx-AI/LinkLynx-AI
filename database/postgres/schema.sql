


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE TYPE public.audit_action AS ENUM (
    'INVITE_CREATE',
    'INVITE_DISABLE',
    'GUILD_MEMBER_JOIN',
    'GUILD_MEMBER_LEAVE',
    'ROLE_ASSIGN',
    'ROLE_REVOKE',
    'CHANNEL_CREATE',
    'CHANNEL_UPDATE',
    'CHANNEL_DELETE',
    'MESSAGE_DELETE_MOD',
    'USER_BAN',
    'USER_UNBAN'
);



CREATE TYPE public.channel_type AS ENUM (
    'guild_text',
    'dm'
);



CREATE TYPE public.outbox_status AS ENUM (
    'PENDING',
    'SENT',
    'FAILED'
);



CREATE TYPE public.role_level AS ENUM (
    'owner',
    'admin',
    'member'
);



CREATE FUNCTION public.claim_outbox_events(p_limit integer DEFAULT 50, p_lease_seconds integer DEFAULT 30) RETURNS TABLE(id bigint, event_type text, aggregate_id text, payload jsonb)
    LANGUAGE sql
    AS $$
WITH pending AS (
  SELECT outbox_events.id
  FROM outbox_events
  WHERE (
    status = 'PENDING'
    AND (next_retry_at IS NULL OR next_retry_at <= now())
  ) OR (
    status = 'FAILED'
    AND next_retry_at IS NOT NULL
    AND next_retry_at <= now()
  )
  ORDER BY created_at
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED
)
UPDATE outbox_events o
SET
  next_retry_at = now() + make_interval(secs => p_lease_seconds),
  updated_at = now()
FROM pending
WHERE o.id = pending.id
RETURNING o.id, o.event_type, o.aggregate_id, o.payload;
$$;



CREATE FUNCTION public.enforce_dm_pairs_channel_type() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM channels c
    WHERE c.id = NEW.channel_id
      AND c.type = 'dm'
  ) THEN
    RAISE EXCEPTION 'dm_pairs.channel_id must reference channels.type=dm';
  END IF;

  RETURN NEW;
END;
$$;



CREATE FUNCTION public.mark_outbox_event_failed(p_id bigint, p_retry_seconds integer DEFAULT 15) RETURNS void
    LANGUAGE sql
    AS $$
UPDATE outbox_events
SET
  status = 'FAILED',
  attempts = attempts + 1,
  next_retry_at = now() + make_interval(secs => p_retry_seconds),
  updated_at = now()
WHERE id = p_id;
$$;



CREATE FUNCTION public.mark_outbox_event_sent(p_id bigint) RETURNS void
    LANGUAGE sql
    AS $$
UPDATE outbox_events
SET
  status = 'SENT',
  next_retry_at = NULL,
  updated_at = now()
WHERE id = p_id;
$$;



CREATE FUNCTION public.set_users_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;



CREATE FUNCTION public.upsert_channel_reads_monotonic(p_channel_id bigint, p_user_id bigint, p_last_read_message_id bigint, p_last_client_seq bigint) RETURNS void
    LANGUAGE sql
    AS $$
INSERT INTO channel_reads (
  channel_id,
  user_id,
  last_read_message_id,
  last_client_seq,
  updated_at
)
VALUES (
  p_channel_id,
  p_user_id,
  p_last_read_message_id,
  p_last_client_seq,
  now()
)
ON CONFLICT (channel_id, user_id)
DO UPDATE
SET
  last_read_message_id = CASE
    WHEN channel_reads.last_read_message_id IS NULL THEN EXCLUDED.last_read_message_id
    WHEN EXCLUDED.last_read_message_id IS NULL THEN channel_reads.last_read_message_id
    ELSE GREATEST(channel_reads.last_read_message_id, EXCLUDED.last_read_message_id)
  END,
  last_client_seq = CASE
    WHEN channel_reads.last_client_seq IS NULL THEN EXCLUDED.last_client_seq
    WHEN EXCLUDED.last_client_seq IS NULL THEN channel_reads.last_client_seq
    ELSE GREATEST(channel_reads.last_client_seq, EXCLUDED.last_client_seq)
  END,
  updated_at = now();
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;


CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    guild_id bigint,
    actor_id bigint,
    action public.audit_action NOT NULL,
    target_type text,
    target_id bigint,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.auth_identities (
    provider text NOT NULL,
    provider_subject text NOT NULL,
    principal_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_auth_identities_provider_non_empty CHECK ((length(provider) > 0)),
    CONSTRAINT chk_auth_identities_provider_subject_non_empty CHECK ((length(provider_subject) > 0))
);



CREATE TABLE public.channel_last_message (
    channel_id bigint NOT NULL,
    last_message_id bigint NOT NULL,
    last_message_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.channel_permission_overrides (
    channel_id bigint NOT NULL,
    level public.role_level NOT NULL,
    can_view boolean,
    can_post boolean
);



COMMENT ON COLUMN public.channel_permission_overrides.can_view IS 'NULL はロール既定値を継承、TRUE/FALSE は明示上書き。';



COMMENT ON COLUMN public.channel_permission_overrides.can_post IS 'NULL はロール既定値を継承、TRUE/FALSE は明示上書き。';



CREATE TABLE public.channel_reads (
    channel_id bigint NOT NULL,
    user_id bigint NOT NULL,
    last_read_message_id bigint,
    last_client_seq bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.channels (
    id bigint NOT NULL,
    type public.channel_type NOT NULL,
    guild_id bigint,
    name text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_channels_shape_dm CHECK (((type <> 'dm'::public.channel_type) OR (guild_id IS NULL))),
    CONSTRAINT chk_channels_shape_guild_text CHECK (((type <> 'guild_text'::public.channel_type) OR ((guild_id IS NOT NULL) AND (name IS NOT NULL))))
);



CREATE TABLE public.dm_pairs (
    user_low bigint NOT NULL,
    user_high bigint NOT NULL,
    channel_id bigint NOT NULL,
    CONSTRAINT chk_dm_pairs_order CHECK ((user_low < user_high))
);



CREATE TABLE public.dm_participants (
    channel_id bigint NOT NULL,
    user_id bigint NOT NULL
);



CREATE TABLE public.guild_member_roles (
    guild_id bigint NOT NULL,
    user_id bigint NOT NULL,
    level public.role_level NOT NULL
);



CREATE TABLE public.guild_members (
    guild_id bigint NOT NULL,
    user_id bigint NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    nickname text
);



CREATE TABLE public.guild_roles (
    guild_id bigint NOT NULL,
    level public.role_level NOT NULL,
    name text NOT NULL
);



CREATE TABLE public.guilds (
    id bigint NOT NULL,
    name text NOT NULL,
    owner_id bigint NOT NULL,
    icon_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.invite_uses (
    invite_id bigint NOT NULL,
    used_by bigint NOT NULL,
    used_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.invites (
    id bigint NOT NULL,
    guild_id bigint NOT NULL,
    created_by bigint,
    code text NOT NULL,
    expires_at timestamp with time zone,
    max_uses integer,
    uses integer DEFAULT 0 NOT NULL,
    is_disabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_invites_max_uses_positive CHECK (((max_uses IS NULL) OR (max_uses > 0))),
    CONSTRAINT chk_invites_uses_lte_max CHECK (((max_uses IS NULL) OR (uses <= max_uses))),
    CONSTRAINT chk_invites_uses_non_negative CHECK ((uses >= 0))
);



CREATE TABLE public.outbox_events (
    id bigint NOT NULL,
    event_type text NOT NULL,
    aggregate_id text NOT NULL,
    payload jsonb NOT NULL,
    status public.outbox_status DEFAULT 'PENDING'::public.outbox_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_outbox_attempts_non_negative CHECK ((attempts >= 0))
);



CREATE TABLE public.users (
    id bigint NOT NULL,
    email text NOT NULL,
    display_name text NOT NULL,
    avatar_key text,
    status_text text,
    theme text DEFAULT 'dark'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_users_theme CHECK ((theme = ANY (ARRAY['dark'::text, 'light'::text])))
);



ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.auth_identities
    ADD CONSTRAINT auth_identities_pkey PRIMARY KEY (provider, provider_subject);



ALTER TABLE ONLY public.channel_last_message
    ADD CONSTRAINT channel_last_message_pkey PRIMARY KEY (channel_id);



ALTER TABLE ONLY public.channel_permission_overrides
    ADD CONSTRAINT channel_permission_overrides_pkey PRIMARY KEY (channel_id, level);



ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_pkey PRIMARY KEY (channel_id, user_id);



ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.dm_pairs
    ADD CONSTRAINT dm_pairs_pkey PRIMARY KEY (user_low, user_high);



ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_pkey PRIMARY KEY (channel_id, user_id);



ALTER TABLE ONLY public.guild_member_roles
    ADD CONSTRAINT guild_member_roles_pkey PRIMARY KEY (guild_id, user_id);



ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_pkey PRIMARY KEY (guild_id, user_id);



ALTER TABLE ONLY public.guild_roles
    ADD CONSTRAINT guild_roles_pkey PRIMARY KEY (guild_id, level);



ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.invite_uses
    ADD CONSTRAINT invite_uses_pkey PRIMARY KEY (invite_id, used_by);



ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_code_key UNIQUE (code);



ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.auth_identities
    ADD CONSTRAINT uq_auth_identities_provider_principal UNIQUE (provider, principal_id);



ALTER TABLE ONLY public.dm_pairs
    ADD CONSTRAINT uq_dm_pairs_channel UNIQUE (channel_id);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);



CREATE INDEX idx_audit_guild_time ON public.audit_logs USING btree (guild_id, created_at DESC) WHERE (guild_id IS NOT NULL);



CREATE INDEX idx_auth_identities_principal_id ON public.auth_identities USING btree (principal_id);



CREATE INDEX idx_channel_last_message_time ON public.channel_last_message USING btree (last_message_at DESC);



CREATE INDEX idx_channel_reads_user ON public.channel_reads USING btree (user_id);



CREATE INDEX idx_channels_guild ON public.channels USING btree (guild_id) WHERE (type = 'guild_text'::public.channel_type);



CREATE INDEX idx_dm_participants_user ON public.dm_participants USING btree (user_id);



CREATE INDEX idx_guild_members_user ON public.guild_members USING btree (user_id);



CREATE INDEX idx_invites_expires ON public.invites USING btree (expires_at) WHERE (expires_at IS NOT NULL);



CREATE INDEX idx_invites_guild ON public.invites USING btree (guild_id);



CREATE INDEX idx_outbox_failed ON public.outbox_events USING btree (status, created_at DESC) WHERE (status = 'FAILED'::public.outbox_status);



CREATE INDEX idx_outbox_pending ON public.outbox_events USING btree (status, next_retry_at, created_at);



CREATE UNIQUE INDEX uq_users_email_lower ON public.users USING btree (lower(email));



CREATE TRIGGER trg_enforce_dm_pairs_channel_type BEFORE INSERT OR UPDATE ON public.dm_pairs FOR EACH ROW EXECUTE FUNCTION public.enforce_dm_pairs_channel_type();



CREATE TRIGGER trg_users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_users_updated_at();



ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.auth_identities
    ADD CONSTRAINT auth_identities_principal_id_fkey FOREIGN KEY (principal_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_last_message
    ADD CONSTRAINT channel_last_message_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_permission_overrides
    ADD CONSTRAINT channel_permission_overrides_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.dm_pairs
    ADD CONSTRAINT dm_pairs_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.dm_pairs
    ADD CONSTRAINT dm_pairs_user_high_fkey FOREIGN KEY (user_high) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.dm_pairs
    ADD CONSTRAINT dm_pairs_user_low_fkey FOREIGN KEY (user_low) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.guild_member_roles
    ADD CONSTRAINT guild_member_roles_guild_id_level_fkey FOREIGN KEY (guild_id, level) REFERENCES public.guild_roles(guild_id, level) ON DELETE RESTRICT;



ALTER TABLE ONLY public.guild_member_roles
    ADD CONSTRAINT guild_member_roles_guild_id_user_id_fkey FOREIGN KEY (guild_id, user_id) REFERENCES public.guild_members(guild_id, user_id) ON DELETE CASCADE;



ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.guild_roles
    ADD CONSTRAINT guild_roles_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE RESTRICT;



ALTER TABLE ONLY public.invite_uses
    ADD CONSTRAINT invite_uses_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.invites(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.invite_uses
    ADD CONSTRAINT invite_uses_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;




