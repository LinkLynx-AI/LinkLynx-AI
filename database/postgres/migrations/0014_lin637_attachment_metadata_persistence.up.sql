CREATE TABLE message_attachments_v2 (
  message_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ,

  PRIMARY KEY (message_id, object_key),
  CONSTRAINT chk_msg_att_v2_object_key_non_empty CHECK (length(object_key) > 0),
  CONSTRAINT chk_msg_att_v2_object_key_prefix CHECK (object_key LIKE 'v0/tenant/%'),
  CONSTRAINT chk_msg_att_v2_mime_non_empty CHECK (length(mime_type) > 0),
  CONSTRAINT chk_msg_att_v2_size_non_negative CHECK (size_bytes >= 0),
  CONSTRAINT chk_msg_att_v2_sha256_format CHECK (sha256 ~ '^[0-9A-Fa-f]{64}$'),
  CONSTRAINT chk_msg_att_v2_deleted_at_order CHECK (
    deleted_at IS NULL OR deleted_at >= created_at
  ),
  CONSTRAINT chk_msg_att_v2_retention_order CHECK (
    retention_until IS NULL OR retention_until >= created_at
  )
);

CREATE UNIQUE INDEX uq_msg_att_v2_object_key
  ON message_attachments_v2 (object_key);

CREATE INDEX idx_msg_att_v2_message_created
  ON message_attachments_v2 (message_id, created_at DESC, object_key);

CREATE INDEX idx_msg_att_v2_retention_active
  ON message_attachments_v2 (retention_until)
  WHERE retention_until IS NOT NULL
    AND deleted_at IS NULL;

CREATE INDEX idx_msg_att_v2_deleted_at
  ON message_attachments_v2 (deleted_at)
  WHERE deleted_at IS NOT NULL;
