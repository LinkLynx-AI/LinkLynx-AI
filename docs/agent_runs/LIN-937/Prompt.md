# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-937` として message usecase を Scylla / Postgres metadata に配線する。
- transport 層が direct CQL なしで send / list を使える service 境界を用意する。
- cursor paging / validation / metadata update の責務境界をコード上で明示する。

## Non-goals
- HTTP handler の本実装切り替え
- WS fanout 実装
- edit / delete / DM / search

## Deliverables
- `rust/crates/domains/message` に message usecase / port / error 境界を追加
- `rust/crates/platform/scylla/message` に append/list adapter を追加
- `rust/crates/platform/postgres/message` に access check / last_message metadata repository を追加
- `apps/api` に runtime composition root を追加

## Done when
- [x] domain / usecase から Scylla append / list を呼び出せる
- [x] Postgres metadata 更新境界が明示されている
- [x] `apps/api` が service を組み立てられる
- [ ] repo gate (`make rust-lint`, `make validate`) を通す

## Constraints
- Perf: cursor paging は bucket 単位で limit+1 を守る
- Security: AuthZ は既存 fail-close を崩さず、channel membership 確認は Postgres metadata repository 側で行う
- Compatibility: additive only、既存 `message-api` / `protocol-ws` 契約は破壊しない
