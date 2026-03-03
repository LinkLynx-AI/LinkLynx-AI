# LIN-635 Prompt

## Goal
- 返信参照（`reply_to_message_id`）とピン留め状態（`pinned_at` / `pinned_by`）を永続化可能にする。
- 削除済み参照先はトゥームストーン表示整合を前提に扱える設計にする。
- 既存のScylla履歴/冪等保存契約を壊さない。

## Non-goals
- 返信通知配信やUI挙動の実装。
- 検索インデックス仕様の全面変更。
- メッセージ本文SoR（Scylla）の破壊的変更。

## Done conditions
- 返信関係を `message_id` で一意追跡できる。
- ピン留め/解除を監査できる列定義が存在する。
- `db-migrate` / `db-schema-check` / `validate` が通る。
