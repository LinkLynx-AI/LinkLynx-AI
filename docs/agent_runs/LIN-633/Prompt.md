# LIN-633 Prompt

## Goal
- チャンネル権限上書きをロール単位に加えてユーザー単位でも保存可能にする。
- deny/allow/継承（NULL）の三値を維持し、優先順（ユーザー優先）を契約化する。
- Postgres override から SpiceDB tuple への変換規約を文書化する。

## Non-goals
- Authorizer全面実装。
- 既存APIの全面更新。
- UI挙動実装。

## Done conditions
- ユーザー単位overrideを保存できるDBスキーマが追加される。
- ロールのみ設定時の互換挙動を壊さない（既存テーブルは維持）。
- fail-close整合の評価順が契約文書に定義される。
