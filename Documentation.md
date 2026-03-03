# Documentation

## Current status
- Now: `server/guild` Rust バックエンドのレビュー修正ループを完了。
- Next: 必要ならコミット/PR 化。

## Decisions
- Start mode は `standalone smallest-unit`。
- 変更は `guild_channel` 実装と関連テストに限定。
- 既存API契約（`guild_not_found` と `guild_membership_required` の分類、`VALIDATION_ERROR`）を維持。

## Review gate evidence
- 初回 `reviewer`: `gate: block`
- 修正後 `reviewer`（差分対象）: `gate: pass`
- `reviewer_ui_guard`: 両回とも `run_ui_checks: false`

## Validation evidence
- `cd rust && cargo test -p linklynx_backend guild_channel`
- `make validate`

## Known issues / follow-ups
- なし（今回差分に対する blocking 指摘は解消済み）。
