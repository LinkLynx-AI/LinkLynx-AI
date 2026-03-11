-- no-transaction

ALTER TYPE channel_type
  ADD VALUE IF NOT EXISTS 'guild_category';
