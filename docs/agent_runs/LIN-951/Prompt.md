# Prompt

## Goals
- `LIN-951` として、v2 server role CRUD / reorder、member role assignment、channel role/user permission override の backend API を実装する。
- `guild_roles_v2`, `guild_member_roles_v2`, `channel_role_permission_overrides_v2`, `channel_user_permission_overrides_v2` を SoR として、validation と event 経路まで end-to-end で繋ぐ。

## Non-goals
- frontend UI 接続
- request-time `AUTHZ_PROVIDER=spicedb` 適用切替
- Discord full permission bitset 導入

## Deliverables
- backend endpoint 実装
- Postgres transaction / validation / outbox event 実装
- handler/service/postgres テスト
- `docs/agent_runs/LIN-951/*`

## Done when
- [x] role CRUD / reorder が contract どおりに動く
- [x] member role assignment と channel permission read/write が contract どおりに動く
- [x] system role 保護 / cross-guild 拒否 / owner lock-out 防止が固定される
- [x] invalidation / tuple sync 用 event が write transaction と同時に生成される

## Constraints
- Perf: 既存 `user_directory` / outbox / tuple sync 基盤を再利用する
- Security: fail-close と server-side validation を優先する
- Compatibility: `LIN-950` contract と既存 `*_v2` schema を壊さない
