# LIN-803 Plan

## Milestones
1. Add migration `0008_lin803_server_channel_minimal_contract` (up/down).
2. Update database documentation and add LIN-803 contract file.
3. Regenerate schema/generated DB artifacts.
4. Execute required quality commands and record results.

## Acceptance focus
- `guilds/channels` の ID 採番基盤が DB デフォルトで確定している。
- `guilds.name` と `channels(guild_text).name` の空白文字データが拒否される。
- server rail/channel list で利用する索引が DB 契約として固定される。

## Validation commands
- `make db-migrate`
- `make db-migrate-info`
- `make db-schema`
- `make db-schema-check`
- `make gen`
- `make validate`
- `make rust-lint`
- `cd typescript && npm run typecheck`
