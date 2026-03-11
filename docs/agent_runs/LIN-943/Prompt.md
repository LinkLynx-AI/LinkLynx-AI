# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-942` backend DTO に合わせて frontend の channel model / API client を hierarchy-aware に更新する。
- sidebar で category と top-level text channel を実 API データから安定表示し、collapse state を機能させる。
- category 作成、category 配下 text channel 作成、category delete 後の route fallback を既存 modal / context menu 導線で成立させる。

## Non-goals
- drag-and-drop 並び替え、thread UI、voice/forum/stage UI は扱わない。
- backend 契約や AuthZ ルールの再定義は行わない。

## Deliverables
- `GuildChannelAPIClient` / shared model の DTO 正規化更新。
- sidebar / create modal / edit-delete modal / route fallback の category-aware 化。
- frontend regression tests と validation evidence。

## Done when
- [ ] category と top-level channel が左カラムで正しく分離表示される。
- [ ] category 作成と category 配下 channel 作成ができる。
- [ ] child channel 作成後の route / active state が崩れない。
- [ ] category 非遷移 / delete fallback / error 表示が既存 UX と整合する。

## Constraints
- Perf: 既存 query key と cache shape を大きく変えない。
- Security: category は message target にしない前提を崩さない。
- Compatibility: `LIN-942` の `type`, `parent_id`, `position` を additive に取り込む。
