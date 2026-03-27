# Documentation

## Current status
- Now: LIN-954 の実装と検証は完了
- Next: commit / PR / Linear 更新

## Decisions
- `AUTHZ_UNAVAILABLE` は frontend settings 導線でも guard screen として観測できるよう、`ChannelEditPermissions` の回帰で固定した。
- local 検証手順は新しい runbook を増やさず、既存の runtime runbook と tuple sync operations runbook へ追記する構成を採用した。
- 切り分けは `write -> invalidation -> tuple sync -> read path` の順で追う。

## How to run / demo
- `cd typescript && npx vitest run src/features/modals/ui/channel-edit-permissions.test.tsx`
- `make authz-spicedb-up`
- `make authz-spicedb-health`
- API を `AUTHZ_PROVIDER=spicedb` で起動する。
- `ServerRoles` / `ServerMembers` / `ChannelEditPermissions` で role または override を更新し、permission snapshot と実操作の allow/deny 反転を確認する。

## Known issues / follow-ups
- local smoke は手動手順なので、将来的に full integration 化する余地は残る。
- 今回は runbook と targeted regression に限定し、新しい E2E 基盤追加は行っていない。

## Validation
- `cd typescript && npx vitest run src/features/modals/ui/channel-edit-permissions.test.tsx`
- `make validate`
