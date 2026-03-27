# Documentation

## Current status
- Status: completed
- Scope delivered:
  - `role settings` / `member role assignment` / `channel permission editor` / `channel create-edit-delete` を request-time `Manage` 保護へ揃えた
  - `guild_channel` / `user_directory` の対象 path から direct DB の manage policy 判定を外し、shared `Authorizer` を primary source に寄せた

## Decisions
- `Manage` が必要な route は middleware で `Manage` を要求し、service 側の direct DB manage 判定を primary authz source にしない。
- `permission snapshot` は既存の `resolve_permission_flag` / `resolve_channel_permission_snapshot` を維持し、実操作との整合は route mapping 側で揃える。
- `guild_channel` / `user_directory` service は existence / validation / persistence を責務に残し、policy 拒否は middleware の `403/AUTHZ_DENIED` と `503/AUTHZ_UNAVAILABLE` へ統一する。
- local runtime smoke は `make authz-spicedb-up` と `make authz-spicedb-health` で確認し、SpiceDB 未起動時の fail-close baseline は `ADR-004` に従う。

## How to run / demo
- Validation:
  - `cargo test -p linklynx_backend -- --nocapture`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
  - `make authz-spicedb-up`
  - `make authz-spicedb-health`
  - `make validate`
- Local smoke:
  - Docker compose の local SpiceDB を起動し、health check が `SpiceDB gRPC/HTTP endpoints are ready` を返すことを確認した。

## Known issues / follow-ups
- frontend settings 接続は `LIN-953`
- end-to-end / SpiceDB local runtime 回帰整理は `LIN-954`
