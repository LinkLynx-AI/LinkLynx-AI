# Documentation

## Current status
- Now: LIN-977 の実装と主要検証は完了。
- Next: review gate 結果を確認し、必要なら追修正する。

## Decisions
- `AUTHZ_PROVIDER` 未設定は fail-close とする。
- `noop` は明示指定された一時例外としてのみ残す。
- `AUTHZ_ALLOW_ALL_UNTIL` は runtime で期限切れを判定する。
- `AUTHZ_PROVIDER=spicedb` の設定不備は暗黙 fallback せず fail-close に固定する。

## How to run / demo
- `cd rust && cargo test -p linklynx_backend runtime_provider_`
- `make rust-lint`
- `make validate`

## Known issues / follow-ups
- live runtime smoke は `make dev` ベースの compose 起動が必要で、今回の変更では未実施。
- `make validate` 中の Python Makefile は既存の `m` コマンド参照不備により `format/test` を実行していないが、レシピ上は `Error 127 (ignored)` として扱われる。

## Validation log
- `cd rust && cargo test -p linklynx_backend runtime_provider_ -- --nocapture`
  - pass
  - `runtime_provider_missing_is_fail_closed`
  - `runtime_provider_empty_is_fail_closed`
  - `runtime_provider_unknown_is_fail_closed`
  - `runtime_provider_noop_allows_only_before_expiry`
  - `runtime_provider_noop_expired_is_fail_closed`
  - `runtime_provider_noop_invalid_expiry_is_fail_closed`
  - `runtime_provider_spicedb_invalid_config_is_fail_closed`
- `cd rust && cargo fmt --all`
  - pass
- `make rust-lint`
  - pass
- `cd typescript && make setup`
  - pass
  - `node_modules` 不在を解消するために実施
- `make validate`
  - pass
  - TypeScript format/lint/test と Rust format/lint/test は完走
  - Python Makefile の `m` コマンド参照不備は既存状態のまま `ignored` 扱い
- `cd typescript && pnpm typecheck`
  - pass
- `git diff --check`
  - pass

## Review gate
- `reviewer_simple`
  - pass
  - blocking finding なし
- `reviewer_ui_guard`
  - UI 影響なし
  - `reviewer_ui` skip

## Runtime smoke
- 非 trivial な backend 変更だが、`make dev` ベースの live smoke は未実施
- skip rationale:
  - 今回の差分は runtime provider の環境変数分岐と fail-close 制御に限定される
  - `/protected/ping` などの live check には compose 起動と手動疎通が必要
  - 代替として workspace Rust tests と targeted runtime tests で provider 切替の挙動を固定した
