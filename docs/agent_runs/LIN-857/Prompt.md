# LIN-857 Prompt

## Goal
- v0権限テーブル/カラムを post-cutover で削除し、v2モデルへ収束させる。

## Non-goals
- SpiceDBクライアント実装。
- 非権限スキーマ変更。

## Done conditions
- 削除対象が migration で除去される。
- seed / docs が v2基準に更新される。
- `db-migrate` / `db-schema-check` が通る。
