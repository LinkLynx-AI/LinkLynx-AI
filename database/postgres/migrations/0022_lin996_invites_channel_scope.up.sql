ALTER TABLE invites
  ADD COLUMN channel_id BIGINT REFERENCES channels(id) ON DELETE SET NULL;

CREATE INDEX idx_invites_guild_channel
  ON invites (guild_id, channel_id)
  WHERE channel_id IS NOT NULL;
