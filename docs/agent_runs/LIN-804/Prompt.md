# LIN-804 Prompt

## Goal
- `display_name` / `status_text` / `avatar_key` の取得・更新APIを実装する。
- 入力バリデーションとエラー契約を固定する。
- 後続のプロフィールFE連携（LIN-807）とテーマAPI（LIN-808）の前提契約を確定する。

## Non-goals
- `theme` の取得/更新実装。
- プロフィール以外の設定項目追加。
- フロントエンド実装。

## Done conditions
- `GET /users/me/profile` を実装済み。
- `PATCH /users/me/profile` を実装済み。
- 3項目のバリデーションとエラー契約がテストで固定される。
- `docs/agent_runs/LIN-804/Documentation.md` に検証結果が記録される。
