# LIN-803 Server/Channel Minimal DB Contract

## Purpose

- Target issue: LIN-803
- Parent issue: LIN-793 (F01-01)
- This contract fixes the minimum Postgres schema requirements needed by LIN-806 (`guild/channel` list/create APIs).

## Scope

In scope:

- `guilds / guild_members / channels` minimal delta migration
- ID provisioning baseline for `guilds` and `channels`
- input quality constraints for guild/channel names
- list-query-oriented index additions for server rail and channel list

Out of scope:

- category/thread schema
- invite/DM/message feature changes
- strict membership consistency triggers (for example `channels.created_by` must belong to `guild_members`)

## Fixed Contract (LIN-803)

### 1. ID generation baseline

- `guilds.id` uses `DEFAULT nextval('guilds_id_seq')`.
- `channels.id` uses `DEFAULT nextval('channels_id_seq')`.
- both sequences are initialized from existing max IDs.

### 2. Name validation baseline

- `guilds.name` must not be blank (`btrim(name) <> ''`).
- `channels` with `type = guild_text` must not have blank `name`.
- existing shape constraints for `guild_text`/`dm` remain unchanged.

### 3. List query index baseline

- `idx_guild_members_user_joined_guild` on `(user_id, joined_at DESC, guild_id)`.
- `idx_channels_guild_created_id` on `(guild_id, created_at ASC, id ASC)` with `WHERE type = 'guild_text'`.

## LIN-806 Handoff Query Matrix

Representative queries this issue optimizes for:

1. Server rail source query (guilds the principal belongs to):
- `guild_members` filter: `user_id = :principal_id`
- stable order: `joined_at DESC`, secondary by `guild_id`

2. Channel list source query (channels inside a guild):
- `channels` filter: `guild_id = :guild_id AND type = 'guild_text'`
- stable order: `created_at ASC`, secondary by `id ASC`

3. Create APIs:
- guild/channel `id` can be omitted safely by API layer due to DB default sequence.

## Operations and compatibility

- Follows LIN-588 forward-only migration policy.
- Existing migrations are not modified; only `0008_lin803_server_channel_minimal_contract` is appended.
- This change is additive/non-breaking for downstream issues.

## References

- `docs/DATABASE.md`
- `database/postgres/migrations/0008_lin803_server_channel_minimal_contract.up.sql`
- `database/postgres/migrations/0008_lin803_server_channel_minimal_contract.down.sql`
- `database/contracts/lin588_postgres_operations_baseline.md`
