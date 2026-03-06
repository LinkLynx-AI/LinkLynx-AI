# Plan

## Rules
- Stop-and-fix: レビューまたは検証が失敗した場合は次工程へ進まず修正する。
- Scope lock: `server/guild` 関連以外は変更しない。

## Milestones
### M1: 対象特定と前提確認
- Acceptance criteria:
  - [x] `guild_channel` 周辺の実装と既存契約を把握
  - [x] 調査対象ファイルを確定
- Validation:
  - `rg --files rust/apps/api/src/guild_channel`

### M2: 初回レビューゲート実行
- Acceptance criteria:
  - [x] `reviewer` を実行して指摘一覧を取得
  - [x] UI影響有無を判断（必要時のみ UI review）
- Validation:
  - `reviewer` agent result

### M3: 指摘修正 + コード検証
- Acceptance criteria:
  - [x] blocking 指摘を修正
  - [x] Rust 検証コマンドが成功
- Validation:
  - `make validate`
  - 必要に応じて `cd rust && cargo test -p api guild_channel`

### M4: 再レビューで収束
- Acceptance criteria:
  - [x] `reviewer` 再実行で blocking 指摘 0
  - [x] 実施ログを `Documentation.md` に記録
- Validation:
  - `reviewer` agent result (pass)
