CREATE TABLE message_create_idempotency_keys (
  principal_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  state TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  message_created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (principal_id, channel_id, idempotency_key),
  CONSTRAINT chk_msg_create_idempotency_key_non_empty
    CHECK (length(btrim(idempotency_key)) > 0),
  CONSTRAINT chk_msg_create_idempotency_payload_non_empty
    CHECK (length(btrim(payload_fingerprint)) > 0),
  CONSTRAINT chk_msg_create_idempotency_state
    CHECK (state IN ('reserved', 'completed'))
);
