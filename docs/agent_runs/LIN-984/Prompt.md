# Prompt

## Goals
- `/internal/auth/metrics`、`/internal/authz/metrics`、`/internal/authz/cache/invalidate` を一般の authenticated user 導線から切り離す。
- bearer token だけでは通らない dedicated guard を追加し、`AUTHZ_PROVIDER=noop` や `RestPath + can_view` に依存しない internal 境界を固定する。
- request_id / caller boundary / outcome を internal endpoint の監査ログへ残す。

## Non-goals
- 一般ユーザー向けの管理 UI 追加。
- internal endpoint の業務機能追加。
- AuthZ モデルや SpiceDB schema の拡張。

## Deliverables
- Rust backend の internal dedicated guard 実装。
- internal endpoint 回帰テスト。
- AuthZ 境界ドキュメント更新。
- LIN-984 run memory。

## Done when
- [ ] bearer token のみで internal endpoint へ到達しても成功しない
- [ ] dedicated guard を満たす経路のみ metrics / invalidate が利用できる
- [ ] `AUTHZ_PROVIDER=noop` や deny/unavailable authorizer に依存せず internal endpoint が利用できる
- [ ] docs と validation evidence が更新される

## Constraints
- 差分は internal endpoint guard と関連 docs / tests に限定する。
- fail-open を作らない。
