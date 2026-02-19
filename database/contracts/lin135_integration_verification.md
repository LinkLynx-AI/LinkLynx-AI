# LIN-135 Integration Verification

This checklist verifies migration ordering and rollback consistency.

## Preconditions

- PostgreSQL is running on `localhost:5432`.
- `sqlx-cli` is installed locally.
- `DATABASE_URL` points to the test database.

## Required Migration Order

1. `0001_lin137_auth_profile`
2. `0002_lin138_guild_channel_invite`
3. `0003_lin139_permissions_reads_outbox`

## Commands

```bash
make db-up
make db-migrate
make db-migrate-info
make db-migrate-revert
make db-migrate
```

## Verification Items

1. `users` theme check blocks invalid values.
2. `uq_users_email_lower` blocks case-insensitive duplicates.
3. `password_reset_tokens` enforces one active token per user.
4. `invites` blocks `uses > max_uses`.
5. `dm_pairs` blocks non-dm channel references.
6. `channel_reads` monotonic upsert contract is documented and applied in application SQL.
7. `outbox_events` pending index exists and is used by pending query plans.
