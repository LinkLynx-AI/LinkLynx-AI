# Documentation.md (Status / audit log)

## Current status
- Now: implementing `LIN-996` on `codex/LIN-996-channel-scoped-invites`.
- Next: land backend/TS updates, run validation, then prepare review evidence.

## Decisions
- Add `invites.channel_id` as nullable for backward compatibility with existing rows.
- Keep guild invite routes and add optional `channel_id` filtering in this issue; route/AuthZ split is deferred to `LIN-1001`.
- Expose `channel` metadata on list and public verify/join payloads so later issues can reuse the shape.

## How to run / demo
- Pending implementation and validation.

## Known issues / follow-ups
- Legacy invites without `channel_id` can only appear in guild-wide admin views.
- Invite-specific AuthZ capability is deferred to `LIN-1003` and `LIN-1001`.

## Validation
- `cargo test invite -- --nocapture`: pass
- `cargo test list_guild_invites -- --nocapture`: pass
- `npm run typecheck`: pass
- `npm run test -- channel-edit-invites server-invites guild-channel-api-client`: pass
- `make rust-lint`: pass
- `make validate`: pass
  - Python sub-make still prints `m: not found`, but repository Makefile marks those steps as ignored and overall validate succeeds.
