# Documentation.md (Status / audit log)

## Current status
- Now: `origin/main` merge and `DB Schema Check` fix are complete, and the branch is ready to push for PR re-run.
- Next: push the merge commit and let GitHub Actions re-evaluate PR #1259.

## Decisions
- Add `invites.channel_id` as nullable for backward compatibility with existing rows.
- Keep guild invite routes and add optional `channel_id` filtering in this issue; route/AuthZ split is deferred to `LIN-1001`.
- Expose `channel` metadata on list and public verify/join payloads so later issues can reuse the shape.

## How to run / demo
- Open the channel settings invite tab and confirm only the active channel's invites are listed.
- Open the server settings invite screen and confirm guild-wide invites include channel metadata.
- Run the invite join integration and schema snapshot checks after applying Postgres migrations.

## Known issues / follow-ups
- Legacy invites without `channel_id` can only appear in guild-wide admin views.
- Invite-specific AuthZ capability is deferred to `LIN-1003` and `LIN-1001`.

## Validation
- `cd rust && DATABASE_URL=postgres://postgres:password@localhost:5432/linklynx AUTH_ALLOW_POSTGRES_NOTLS=true INVITE_POSTGRES_INTEGRATION=true cargo test -p linklynx_backend postgres_join_invite_integration_ -- --nocapture`: pass
- `POSTGRES_DUMP_CMD="docker compose exec -T postgres pg_dump -h 127.0.0.1 -U postgres -d linklynx --schema-only --no-owner --no-privileges --exclude-table=_sqlx_migrations" make db-schema-check`: pass
- `cd typescript && pnpm run typecheck`: pass
- `cd typescript && pnpm run test -- channel-edit-invites server-invites guild-channel-api-client`: pass
- `make validate`: pass
