# Documentation.md (Status / audit log)

## Current status
- Now: 実装と required validation の回収が完了
- Next: PR 化して `LIN-917` を完了に進める

## Decisions
- reply は表示済みメッセージの参照表示のみを v1 Done とし、返信送信導線は未接続と明示する。
- pin は persistence 完了済みだが一覧取得と pin/unpin 実行 UI は未接続として扱う。
- reaction は表示済みの集計表示は維持し、追加/解除/詳細参加者表示は未接続として扱う。

## How to run / demo
- hover actions で reaction / reply を押すと未接続 toast が出ることを確認する
- message context menu で reply / pin を押すと未接続 toast が出ることを確認する
- pinned panel と reaction detail modal が fake data ではなく状態説明を表示することを確認する

## Known issues / follow-ups
- pin API / reaction API / reply create は後続 issue で接続が必要
- pinned list の実データ取得は後続 issue で必要

## Validation log
- `2026-03-12`: `make setup`
  - TypeScript 依存関係のセットアップは完了
  - Rust `cargo fetch --locked` は完了
  - Python setup は `python3.10+` 不在で失敗
- `2026-03-12`: `cd typescript && npm run test -- message-context-menu message` は成功
- `2026-03-12`: `cd typescript && npm run typecheck` は成功
- `2026-03-12`: `make validate` は成功
  - TypeScript: `format` / `fsd:check` / `eslint` / `prettier --check` / tests が通過
  - Rust: `cargo fmt --check` / `cargo clippy --workspace --all-targets --all-features -- -D warnings` / `cargo test --workspace` が通過
  - Python: `m black .` / `m ruff check . --fix` / `m unittest ...` は `m: not found` を出すが Makefile 上は ignored で継続
- `2026-03-12`: `make rust-lint` は成功
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets --all-features -- -D warnings`
  - `cargo test --workspace`
- `2026-03-12`: `make db-schema-check` は環境未整備で失敗
  - `docker compose` 実行時に `NEXT_PUBLIC_FIREBASE_API_KEY is required` で停止

## PR Draft
- Title: `[v1/RM-05-04] 返信・ピン・リアクションの接続状態を整理する`
- Summary:
  - fake preview / mock detail をやめ、未接続操作を UI で明示
  - reply / pin / reaction の v1 Done 範囲を docs と一致させる
