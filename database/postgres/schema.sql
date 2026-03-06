


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



CREATE TYPE public.channel_hierarchy_kind AS ENUM (
    'category_child',
    'thread'
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



CREATE FUNCTION public.enforce_channel_hierarchies_v2_scope() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  child_guild_id BIGINT;
  child_type channel_type;
  parent_guild_id BIGINT;
  parent_type channel_type;
BEGIN
  SELECT guild_id, type
  INTO child_guild_id, child_type
  FROM channels
  WHERE id = NEW.child_channel_id;

  IF child_guild_id IS NULL OR child_type <> 'guild_text' THEN
    RAISE EXCEPTION 'child channel must be guild_text with guild_id';
  END IF;

  SELECT guild_id, type
  INTO parent_guild_id, parent_type
  FROM channels
  WHERE id = NEW.parent_channel_id;

  IF parent_guild_id IS NULL OR parent_type <> 'guild_text' THEN
    RAISE EXCEPTION 'parent channel must be guild_text with guild_id';
  END IF;

  IF child_guild_id <> parent_guild_id OR child_guild_id <> NEW.guild_id THEN
    RAISE EXCEPTION 'hierarchy guild scope mismatch';
  END IF;

  RETURN NEW;
END;
$$;



CREATE FUNCTION public.enforce_channel_role_overrides_v2_scope() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  channel_guild_id BIGINT;
BEGIN
  SELECT guild_id
  INTO channel_guild_id
  FROM channels
  WHERE id = NEW.channel_id;

  IF channel_guild_id IS NULL THEN
    RAISE EXCEPTION 'channel_role_permission_overrides_v2.channel_id must reference guild channel';
  END IF;

  IF channel_guild_id <> NEW.guild_id THEN
    RAISE EXCEPTION 'channel_role_permission_overrides_v2.guild_id must match channels.guild_id';
  END IF;

  RETURN NEW;
END;
$$;



CREATE FUNCTION public.enforce_channel_user_overrides_v2_scope() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  channel_guild_id BIGINT;
BEGIN
  SELECT guild_id
  INTO channel_guild_id
  FROM channels
  WHERE id = NEW.channel_id;

  IF channel_guild_id IS NULL THEN
    RAISE EXCEPTION 'channel_user_permission_overrides_v2.channel_id must reference guild channel';
  END IF;

  IF channel_guild_id <> NEW.guild_id THEN
    RAISE EXCEPTION 'channel_user_permission_overrides_v2.guild_id must match channels.guild_id';
  END IF;

  RETURN NEW;
END;
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



CREATE TABLE public.channel_hierarchies_v2 (
    child_channel_id bigint NOT NULL,
    guild_id bigint NOT NULL,
    parent_channel_id bigint NOT NULL,
    hierarchy_kind public.channel_hierarchy_kind NOT NULL,
    parent_message_id bigint,
    "position" integer DEFAULT 0 NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_ch_hier_v2_thread_parent_msg CHECK ((((hierarchy_kind = 'thread'::public.channel_hierarchy_kind) AND (parent_message_id IS NOT NULL)) OR ((hierarchy_kind = 'category_child'::public.channel_hierarchy_kind) AND (parent_message_id IS NULL)))),
    CONSTRAINT chk_channel_hierarchies_v2_not_self CHECK ((child_channel_id <> parent_channel_id)),
    CONSTRAINT chk_channel_hierarchies_v2_position_non_negative CHECK (("position" >= 0))
);



CREATE TABLE public.channel_last_message (
    channel_id bigint NOT NULL,
    last_message_id bigint NOT NULL,
    last_message_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.channel_role_permission_overrides_v2 (
    channel_id bigint NOT NULL,
    guild_id bigint NOT NULL,
    role_key text NOT NULL,
    can_view boolean,
    can_post boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_channel_role_overrides_v2_role_key_non_empty CHECK ((length(role_key) > 0))
);



COMMENT ON COLUMN public.channel_role_permission_overrides_v2.can_view IS 'NULL はロール既定値を継承、TRUE/FALSE は明示上書き。';



COMMENT ON COLUMN public.channel_role_permission_overrides_v2.can_post IS 'NULL はロール既定値を継承、TRUE/FALSE は明示上書き。';



CREATE TABLE public.channel_user_permission_overrides_v2 (
    channel_id bigint NOT NULL,
    guild_id bigint NOT NULL,
    user_id bigint NOT NULL,
    can_view boolean,
    can_post boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



COMMENT ON COLUMN public.channel_user_permission_overrides_v2.can_view IS 'NULL はロール既定値を継承、TRUE/FALSE はユーザー単位で明示上書き。';



COMMENT ON COLUMN public.channel_user_permission_overrides_v2.can_post IS 'NULL はロール既定値を継承、TRUE/FALSE はユーザー単位で明示上書き。';



CREATE VIEW public.channel_permission_overrides_subject_v2 AS
 SELECT channel_role_permission_overrides_v2.channel_id,
    channel_role_permission_overrides_v2.guild_id,
    'role'::text AS subject_type,
    channel_role_permission_overrides_v2.role_key AS subject_id,
    channel_role_permission_overrides_v2.can_view,
    channel_role_permission_overrides_v2.can_post,
    channel_role_permission_overrides_v2.created_at,
    channel_role_permission_overrides_v2.updated_at
   FROM public.channel_role_permission_overrides_v2
UNION ALL
 SELECT channel_user_permission_overrides_v2.channel_id,
    channel_user_permission_overrides_v2.guild_id,
    'user'::text AS subject_type,
    (channel_user_permission_overrides_v2.user_id)::text AS subject_id,
    channel_user_permission_overrides_v2.can_view,
    channel_user_permission_overrides_v2.can_post,
    channel_user_permission_overrides_v2.created_at,
    channel_user_permission_overrides_v2.updated_at
   FROM public.channel_user_permission_overrides_v2;



CREATE TABLE public.channel_pins_v2 (
    channel_id bigint NOT NULL,
    message_id bigint NOT NULL,
    pinned_at timestamp with time zone DEFAULT now() NOT NULL,
    pinned_by bigint,
    unpinned_at timestamp with time zone,
    unpinned_by bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_ch_pins_v2_unpin_pair CHECK ((((unpinned_at IS NULL) AND (unpinned_by IS NULL)) OR (unpinned_at IS NOT NULL))),
    CONSTRAINT chk_ch_pins_v2_unpin_time CHECK (((unpinned_at IS NULL) OR (unpinned_at >= pinned_at)))
);



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
    CONSTRAINT chk_channels_guild_text_name_not_blank CHECK (((type <> 'guild_text'::public.channel_type) OR (btrim(COALESCE(name, ''::text)) <> ''::text))),
    CONSTRAINT chk_channels_shape_dm CHECK (((type <> 'dm'::public.channel_type) OR (guild_id IS NULL))),
    CONSTRAINT chk_channels_shape_guild_text CHECK (((type <> 'guild_text'::public.channel_type) OR ((guild_id IS NOT NULL) AND (name IS NOT NULL))))
);



CREATE SEQUENCE public.channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE public.channels_id_seq OWNED BY public.channels.id;



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



CREATE TABLE public.guild_member_roles_v2 (
    guild_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role_key text NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by bigint
);



CREATE TABLE public.guild_members (
    guild_id bigint NOT NULL,
    user_id bigint NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    nickname text
);



CREATE TABLE public.guild_roles_v2 (
    guild_id bigint NOT NULL,
    role_key text NOT NULL,
    name text NOT NULL,
    priority integer NOT NULL,
    allow_view boolean DEFAULT true NOT NULL,
    allow_post boolean DEFAULT true NOT NULL,
    allow_manage boolean DEFAULT false NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_guild_roles_v2_name_non_empty CHECK ((length(name) > 0)),
    CONSTRAINT chk_guild_roles_v2_role_key_format CHECK ((role_key ~ '^[a-z0-9_]{1,64}$'::text)),
    CONSTRAINT chk_guild_roles_v2_role_key_non_empty CHECK ((length(role_key) > 0))
);



CREATE TABLE public.guilds (
    id bigint NOT NULL,
    name text NOT NULL,
    owner_id bigint NOT NULL,
    icon_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_guilds_name_not_blank CHECK ((btrim(name) <> ''::text))
);



CREATE SEQUENCE public.guilds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE public.guilds_id_seq OWNED BY public.guilds.id;



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



CREATE TABLE public.message_attachments_v2 (
    message_id bigint NOT NULL,
    channel_id bigint NOT NULL,
    object_key text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    sha256 text NOT NULL,
    uploaded_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    retention_until timestamp with time zone,
    CONSTRAINT chk_msg_att_v2_deleted_at_order CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT chk_msg_att_v2_mime_non_empty CHECK ((length(mime_type) > 0)),
    CONSTRAINT chk_msg_att_v2_object_key_non_empty CHECK ((length(object_key) > 0)),
    CONSTRAINT chk_msg_att_v2_object_key_prefix CHECK ((object_key ~~ 'v0/tenant/%'::text)),
    CONSTRAINT chk_msg_att_v2_retention_order CHECK (((retention_until IS NULL) OR (retention_until >= created_at))),
    CONSTRAINT chk_msg_att_v2_sha256_format CHECK ((sha256 ~ '^[0-9A-Fa-f]{64}$'::text)),
    CONSTRAINT chk_msg_att_v2_size_non_negative CHECK ((size_bytes >= 0))
);



CREATE TABLE public.message_reactions_v2 (
    message_id bigint NOT NULL,
    channel_id bigint NOT NULL,
    emoji text NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_msg_reactions_v2_emoji_len CHECK ((length(emoji) <= 128)),
    CONSTRAINT chk_msg_reactions_v2_emoji_non_empty CHECK ((length(emoji) > 0))
);



CREATE TABLE public.message_references_v2 (
    message_id bigint NOT NULL,
    channel_id bigint NOT NULL,
    reply_to_message_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_msg_refs_v2_not_self CHECK ((message_id <> reply_to_message_id))
);



COMMENT ON COLUMN public.message_references_v2.reply_to_message_id IS 'Scylla SoR上の参照先message_id。削除済み参照先のトゥームストーン表示整合のためFKを張らない。';



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



CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;



ALTER TABLE ONLY public.channels ALTER COLUMN id SET DEFAULT nextval('public.channels_id_seq'::regclass);



ALTER TABLE ONLY public.guilds ALTER COLUMN id SET DEFAULT nextval('public.guilds_id_seq'::regclass);



ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);



ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.auth_identities
    ADD CONSTRAINT auth_identities_pkey PRIMARY KEY (provider, provider_subject);



ALTER TABLE ONLY public.channel_hierarchies_v2
    ADD CONSTRAINT channel_hierarchies_v2_pkey PRIMARY KEY (child_channel_id);



ALTER TABLE ONLY public.channel_last_message
    ADD CONSTRAINT channel_last_message_pkey PRIMARY KEY (channel_id);



ALTER TABLE ONLY public.channel_pins_v2
    ADD CONSTRAINT channel_pins_v2_pkey PRIMARY KEY (channel_id, message_id);



ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_pkey PRIMARY KEY (channel_id, user_id);



ALTER TABLE ONLY public.channel_role_permission_overrides_v2
    ADD CONSTRAINT channel_role_permission_overrides_v2_pkey PRIMARY KEY (channel_id, role_key);



ALTER TABLE ONLY public.channel_user_permission_overrides_v2
    ADD CONSTRAINT channel_user_permission_overrides_v2_pkey PRIMARY KEY (channel_id, user_id);



ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.dm_pairs
    ADD CONSTRAINT dm_pairs_pkey PRIMARY KEY (user_low, user_high);



ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_pkey PRIMARY KEY (channel_id, user_id);



ALTER TABLE ONLY public.guild_member_roles_v2
    ADD CONSTRAINT guild_member_roles_v2_pkey PRIMARY KEY (guild_id, user_id, role_key);



ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_pkey PRIMARY KEY (guild_id, user_id);



ALTER TABLE ONLY public.guild_roles_v2
    ADD CONSTRAINT guild_roles_v2_pkey PRIMARY KEY (guild_id, role_key);



ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.invite_uses
    ADD CONSTRAINT invite_uses_pkey PRIMARY KEY (invite_id, used_by);



ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_code_key UNIQUE (code);



ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.message_attachments_v2
    ADD CONSTRAINT message_attachments_v2_pkey PRIMARY KEY (message_id, object_key);



ALTER TABLE ONLY public.message_reactions_v2
    ADD CONSTRAINT message_reactions_v2_pkey PRIMARY KEY (message_id, emoji, user_id);



ALTER TABLE ONLY public.message_references_v2
    ADD CONSTRAINT message_references_v2_pkey PRIMARY KEY (message_id);



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



CREATE INDEX idx_ch_pins_v2_active ON public.channel_pins_v2 USING btree (channel_id, pinned_at DESC, message_id DESC) WHERE (unpinned_at IS NULL);



CREATE INDEX idx_ch_pins_v2_message ON public.channel_pins_v2 USING btree (message_id);



CREATE INDEX idx_channel_hierarchies_v2_guild_kind ON public.channel_hierarchies_v2 USING btree (guild_id, hierarchy_kind, parent_channel_id);



CREATE INDEX idx_channel_hierarchies_v2_parent_pos ON public.channel_hierarchies_v2 USING btree (parent_channel_id, "position", child_channel_id);



CREATE INDEX idx_channel_last_message_time ON public.channel_last_message USING btree (last_message_at DESC);



CREATE INDEX idx_channel_reads_user ON public.channel_reads USING btree (user_id);



CREATE INDEX idx_channel_user_overrides_v2_guild_user ON public.channel_user_permission_overrides_v2 USING btree (guild_id, user_id);



CREATE INDEX idx_channel_user_overrides_v2_user ON public.channel_user_permission_overrides_v2 USING btree (user_id, guild_id);



CREATE INDEX idx_channels_guild ON public.channels USING btree (guild_id) WHERE (type = 'guild_text'::public.channel_type);



CREATE INDEX idx_channels_guild_created_id ON public.channels USING btree (guild_id, created_at, id) WHERE (type = 'guild_text'::public.channel_type);



CREATE INDEX idx_dm_participants_user ON public.dm_participants USING btree (user_id);



CREATE INDEX idx_guild_member_roles_v2_user ON public.guild_member_roles_v2 USING btree (user_id, guild_id);



CREATE INDEX idx_guild_members_user ON public.guild_members USING btree (user_id);



CREATE INDEX idx_guild_roles_v2_priority ON public.guild_roles_v2 USING btree (guild_id, priority DESC, role_key);
CREATE INDEX idx_guild_members_user_joined_guild ON public.guild_members USING btree (user_id, joined_at DESC, guild_id);



CREATE INDEX idx_invites_expires ON public.invites USING btree (expires_at) WHERE (expires_at IS NOT NULL);



CREATE INDEX idx_invites_guild ON public.invites USING btree (guild_id);



CREATE INDEX idx_msg_att_v2_deleted_at ON public.message_attachments_v2 USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);



CREATE INDEX idx_msg_att_v2_message_created ON public.message_attachments_v2 USING btree (message_id, created_at DESC, object_key);



CREATE INDEX idx_msg_att_v2_retention_active ON public.message_attachments_v2 USING btree (retention_until) WHERE ((retention_until IS NOT NULL) AND (deleted_at IS NULL));



CREATE INDEX idx_msg_reactions_v2_msg_emoji_created ON public.message_reactions_v2 USING btree (message_id, emoji, created_at DESC);



CREATE INDEX idx_msg_refs_v2_channel_reply ON public.message_references_v2 USING btree (channel_id, reply_to_message_id, message_id DESC);



CREATE INDEX idx_outbox_failed ON public.outbox_events USING btree (status, created_at DESC) WHERE (status = 'FAILED'::public.outbox_status);



CREATE INDEX idx_outbox_pending ON public.outbox_events USING btree (status, next_retry_at, created_at);



CREATE UNIQUE INDEX uq_channel_hierarchies_v2_thread_parent_message ON public.channel_hierarchies_v2 USING btree (guild_id, parent_channel_id, parent_message_id) WHERE (hierarchy_kind = 'thread'::public.channel_hierarchy_kind);



CREATE UNIQUE INDEX uq_msg_att_v2_object_key ON public.message_attachments_v2 USING btree (object_key);



CREATE UNIQUE INDEX uq_users_email_lower ON public.users USING btree (lower(email));



CREATE TRIGGER trg_enforce_channel_hierarchies_v2_scope BEFORE INSERT OR UPDATE ON public.channel_hierarchies_v2 FOR EACH ROW EXECUTE FUNCTION public.enforce_channel_hierarchies_v2_scope();



CREATE TRIGGER trg_enforce_channel_role_overrides_v2_scope BEFORE INSERT OR UPDATE ON public.channel_role_permission_overrides_v2 FOR EACH ROW EXECUTE FUNCTION public.enforce_channel_role_overrides_v2_scope();



CREATE TRIGGER trg_enforce_channel_user_overrides_v2_scope BEFORE INSERT OR UPDATE ON public.channel_user_permission_overrides_v2 FOR EACH ROW EXECUTE FUNCTION public.enforce_channel_user_overrides_v2_scope();



CREATE TRIGGER trg_enforce_dm_pairs_channel_type BEFORE INSERT OR UPDATE ON public.dm_pairs FOR EACH ROW EXECUTE FUNCTION public.enforce_dm_pairs_channel_type();



CREATE TRIGGER trg_users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_users_updated_at();



ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.auth_identities
    ADD CONSTRAINT auth_identities_principal_id_fkey FOREIGN KEY (principal_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_hierarchies_v2
    ADD CONSTRAINT channel_hierarchies_v2_child_channel_id_fkey FOREIGN KEY (child_channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_hierarchies_v2
    ADD CONSTRAINT channel_hierarchies_v2_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_hierarchies_v2
    ADD CONSTRAINT channel_hierarchies_v2_parent_channel_id_fkey FOREIGN KEY (parent_channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_last_message
    ADD CONSTRAINT channel_last_message_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_pins_v2
    ADD CONSTRAINT channel_pins_v2_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_pins_v2
    ADD CONSTRAINT channel_pins_v2_pinned_by_fkey FOREIGN KEY (pinned_by) REFERENCES public.users(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.channel_pins_v2
    ADD CONSTRAINT channel_pins_v2_unpinned_by_fkey FOREIGN KEY (unpinned_by) REFERENCES public.users(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_reads
    ADD CONSTRAINT channel_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_role_permission_overrides_v2
    ADD CONSTRAINT channel_role_permission_overrides_v2_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_role_permission_overrides_v2
    ADD CONSTRAINT channel_role_permission_overrides_v2_guild_id_role_key_fkey FOREIGN KEY (guild_id, role_key) REFERENCES public.guild_roles_v2(guild_id, role_key) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_user_permission_overrides_v2
    ADD CONSTRAINT channel_user_permission_overrides_v2_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.channel_user_permission_overrides_v2
    ADD CONSTRAINT channel_user_permission_overrides_v2_guild_id_user_id_fkey FOREIGN KEY (guild_id, user_id) REFERENCES public.guild_members(guild_id, user_id) ON DELETE CASCADE;



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



ALTER TABLE ONLY public.guild_member_roles_v2
    ADD CONSTRAINT guild_member_roles_v2_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.guild_member_roles_v2
    ADD CONSTRAINT guild_member_roles_v2_guild_id_role_key_fkey FOREIGN KEY (guild_id, role_key) REFERENCES public.guild_roles_v2(guild_id, role_key) ON DELETE RESTRICT;



ALTER TABLE ONLY public.guild_member_roles_v2
    ADD CONSTRAINT guild_member_roles_v2_guild_id_user_id_fkey FOREIGN KEY (guild_id, user_id) REFERENCES public.guild_members(guild_id, user_id) ON DELETE CASCADE;



ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.guild_roles_v2
    ADD CONSTRAINT guild_roles_v2_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;



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



ALTER TABLE ONLY public.message_attachments_v2
    ADD CONSTRAINT message_attachments_v2_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.message_attachments_v2
    ADD CONSTRAINT message_attachments_v2_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.message_reactions_v2
    ADD CONSTRAINT message_reactions_v2_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.message_reactions_v2
    ADD CONSTRAINT message_reactions_v2_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.message_references_v2
    ADD CONSTRAINT message_references_v2_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;
