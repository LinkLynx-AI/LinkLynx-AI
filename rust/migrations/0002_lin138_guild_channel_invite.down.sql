DROP TRIGGER IF EXISTS trg_enforce_dm_pairs_channel_type ON dm_pairs;
DROP FUNCTION IF EXISTS enforce_dm_pairs_channel_type();

DROP TABLE IF EXISTS dm_pairs;
DROP TABLE IF EXISTS dm_participants;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS invite_uses;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS guild_members;
DROP TABLE IF EXISTS guilds;

DROP TYPE IF EXISTS channel_type;
