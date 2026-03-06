# LIN-636 Prompt

## Goal
- メッセージリアクション（emoji, user_id, created_at）を永続化可能にする。
- 同一ユーザーの同一絵文字を同一メッセージへ重複付与できない制約を導入する。
- message_id基準の集計（count）を支える索引方針を明確化する。

## Non-goals
- カスタム絵文字配布機能の実装。
- UIリアクションパネルの実装。
- メッセージ本文SoR（Scylla）の破壊的変更。

## Done conditions
- add/removeリアクションをDB操作で冪等に扱える。
- 重複リアクションがDB制約で防止される。
- `db-migrate` / `db-schema-check` / `validate` が通る。
