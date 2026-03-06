CREATE TABLE message_reactions_v2 (
  message_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (message_id, emoji, user_id),
  CONSTRAINT chk_msg_reactions_v2_emoji_non_empty CHECK (length(emoji) > 0),
  CONSTRAINT chk_msg_reactions_v2_emoji_len CHECK (length(emoji) <= 128)
);

CREATE INDEX idx_msg_reactions_v2_msg_emoji_created
  ON message_reactions_v2 (message_id, emoji, created_at DESC);
