# LIN-996 Invite Channel Scope Contract

## Summary
- `invites.channel_id` is added as the source of truth for the invite target channel.
- The migration is additive: legacy invite rows may keep `channel_id = NULL` until re-created.
- New invite issuance must persist `channel_id` and return channel metadata in create/list/verify/join payloads.

## Data contract
- Column: `invites.channel_id BIGINT NULL REFERENCES channels(id) ON DELETE SET NULL`
- New index: `idx_invites_guild_channel (guild_id, channel_id)` with `channel_id IS NOT NULL`
- New invite records must reference a `channels.type = 'guild_text'` row in the same guild.

## API contract
- `GET /v1/guilds/{guild_id}/invites` remains the guild-admin surface and returns channel metadata per invite when known.
- `GET /v1/guilds/{guild_id}/invites?channel_id={channel_id}` returns the channel-scoped admin view.
- `DELETE /v1/guilds/{guild_id}/invites/{invite_code}?channel_id={channel_id}` may be used by channel settings to ensure channel-scoped revoke.
- Public verify and join payloads may include channel metadata when `channel_id` is known.

## Compatibility
- Backward compatibility is additive-only. Existing clients that ignore the extra `channel` object continue to work.
- Legacy invite rows without `channel_id` remain visible only in guild-wide admin list and may omit channel metadata.
