# Implement.md (Runbook)

- `LIN-943` は frontend の DTO 接続と UI 導線に限定し、backend 契約や migration は触らない。
- `LIN-942` の `guild_category` / `parent_id` / `position` を唯一の前提にする。
- 変更対象は API client、shared model、sidebar、create/edit/delete modal、route fallback 周辺に絞る。
- category row は message target にしない。必要なフォールバックは text channel か guild root へ戻す。
- validation / review / runtime evidence は `Documentation.md` に逐次追記する。
