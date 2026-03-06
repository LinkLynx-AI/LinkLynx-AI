# LIN-637 Implement Rules

- 添付バイナリSoRはGCSのまま維持し、DBはメタデータのみ保持する。
- `object_key` は LIN-590 の固定命名規約に合わせて最小プレフィックス制約を設ける。
- 保持/削除運用に必要な抽出インデックスを追加し、運用ジョブの走査コストを抑える。
- schema変更時は `database/postgres/schema.sql` と `database/postgres/generated` を再生成する。
