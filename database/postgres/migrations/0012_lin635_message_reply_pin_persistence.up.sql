CREATE TABLE message_references_v2 (
  message_id BIGINT PRIMARY KEY,
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  reply_to_message_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_msg_refs_v2_not_self CHECK (message_id <> reply_to_message_id)
);

CREATE INDEX idx_msg_refs_v2_channel_reply
  ON message_references_v2 (channel_id, reply_to_message_id, message_id DESC);

COMMENT ON COLUMN message_references_v2.reply_to_message_id
  IS 'Scylla SoR上の参照先message_id。削除済み参照先のトゥームストーン表示整合のためFKを張らない。';

CREATE TABLE channel_pins_v2 (
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id BIGINT NOT NULL,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pinned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  unpinned_at TIMESTAMPTZ,
  unpinned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (channel_id, message_id),
  CONSTRAINT chk_ch_pins_v2_unpin_pair CHECK (
    (unpinned_at IS NULL AND unpinned_by IS NULL)
    OR (unpinned_at IS NOT NULL)
  ),
  CONSTRAINT chk_ch_pins_v2_unpin_time CHECK (
    unpinned_at IS NULL OR unpinned_at >= pinned_at
  )
);

CREATE INDEX idx_ch_pins_v2_active
  ON channel_pins_v2 (channel_id, pinned_at DESC, message_id DESC)
  WHERE unpinned_at IS NULL;

CREATE INDEX idx_ch_pins_v2_message
  ON channel_pins_v2 (message_id);
