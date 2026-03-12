# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-941` で固定した契約に従い、guild/channel backend を category-aware に拡張する。
- category 作成、category 配下 text channel 作成、hierarchy-aware list/get/update/delete を backend で成立させる。
- category を message target にしない reject policy を HTTP route と service で一致させる。

## Non-goals
- frontend sidebar/modal 導線の実装は `LIN-943` で扱う。
- thread runtime、voice/forum/stage、reparent は扱わない。

## Deliverables
- category-aware な Rust service / Postgres 実装 / HTTP route。
- create/list/update/delete/message reject の回帰テスト。
- `LIN-943` / `LIN-944` へ渡せる backend validation evidence。
