# LIN-637 Prompt

## Goal
- 添付メタデータ（object_key, mime_type, size_bytes, sha256, uploaded_by, created_at）を永続化する。
- 論理削除/保持運用に必要な列（deleted_at, retention_until）を追加する。
- GCS運用契約（LIN-590）に整合した最小契約を定義する。

## Non-goals
- バイナリ本体保存先の変更。
- CDN最適化や画像変換基盤の実装。
- 署名URL API/運用ロジックの実装。

## Done conditions
- 1メッセージに複数添付を紐づけられる。
- 署名URL発行に必要なメタデータを欠損なく保持できる。
- 保持/削除運用の監査列があり、`db-migrate` / `db-schema-check` / `validate` が通る。
