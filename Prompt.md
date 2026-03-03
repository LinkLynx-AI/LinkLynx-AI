# Prompt

## Goals
- `server/guild` 機能周辺の Rust バックエンドを探索し、レビューエージェント指摘を解消してレビューOK状態まで到達する。
- 変更は依頼スコープ（guild/channel 関連）に限定し、既存契約（AuthZ fail-close/DB制約）を維持する。

## Non-goals
- guild/channel 以外の機能改善やリファクタ。
- API仕様の破壊的変更。

## Deliverables
- `rust/apps/api/src/guild_channel/*` と関連ハンドラの必要最小限修正。
- レビューゲート実行結果（指摘→修正→再レビュー）。
- 検証結果（`make validate` と必要な追加チェック）。

## Done when
- [x] `reviewer` ゲートで blocking 指摘が 0。
- [x] 必要な検証コマンドが成功。
- [x] 変更内容と意図を日本語で説明可能な状態。

## Constraints
- Perf: 不要なクエリ増加やロック競合を導入しない。
- Security: ADR-004 fail-close 契約（`AUTHZ_DENIED` / `AUTHZ_UNAVAILABLE`）を崩さない。
- Compatibility: 既存 REST レスポンス契約（status/code/message）を維持する。
