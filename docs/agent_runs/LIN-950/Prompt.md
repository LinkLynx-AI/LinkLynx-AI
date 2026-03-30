# Prompt

## Goals
- `LIN-949` 配下の `LIN-950` として、v2 server role / channel permission / SpiceDB AuthZ の最小契約を固定する。
- 後続の `LIN-951`〜`LIN-954` が API、UI、AuthZ 適用点、反映経路で迷わない状態にする。

## Non-goals
- backend / frontend の実装着手
- Discord full permission bitset の導入
- `color` / `hoist` / `mentionable` の永続化

## Deliverables
- `database/contracts/lin950_v2_server_role_authz_contract.md`
- `docs/AUTHZ.md` への LIN-950 baseline 追記
- `docs/AUTHZ_API_MATRIX.md` への planned endpoint/action mapping 追記
- `docs/DATABASE.md` への contract 参照追記

## Done when
- [x] v2 最小スコープの role/API/AuthZ 契約が 1 文書で追える
- [x] planned endpoint と `View/Post/Manage` 写像が明記されている
- [x] `@everyone` / system role / owner lock-out / invalidation 経路の扱いが固定されている
- [x] 後続 issue 向けの docs 参照先が更新されている

## Constraints
- Perf: outbox / tuple sync / cache invalidation の既存経路を再利用する
- Security: ADR-004 fail-close を厳守する
- Compatibility: existing `*_v2` schema と permission snapshot 契約を壊さない
