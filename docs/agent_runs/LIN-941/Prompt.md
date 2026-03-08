# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-940` / `LIN-941` の契約整理として、v1 のチャンネルカテゴリ表現を backend / frontend / AuthZ が矛盾なく共有できる形で固定する。
- `guild_category` を非 messageable container として導入し、category 配下に `guild_text` をぶら下げる最小 hierarchy 契約を定義する。
- 後続の `LIN-942` / `LIN-943` / `LIN-944` が endpoint / payload / validation / UI挙動で迷わない状態を作る。

## Non-goals
- sidebar や modal の UI 実装そのものはこの issue で完了させない。
- thread runtime、voice/forum/stage、drag-and-drop 並び替えは扱わない。
- 既存 channel の reparent は v1 スコープに含めない。

## Deliverables
- `channel_type` / `channel_hierarchies_v2` / category delete semantics を反映した DB 契約と migration。
- hierarchy-aware な guild/channel REST request/response 契約。
- `docs/AUTHZ.md` / `docs/AUTHZ_API_MATRIX.md` / `docs/DATABASE.md` の整合更新。
- `LIN-942` 以降へ引き渡せる validation rule と reject policy の明文化。

## Done when
- [ ] `guild_category` の識別方法が DB/API/AuthZ で一意に固定されている。
- [ ] list/create/update/delete の hierarchy-aware 契約が実装と docs に反映されている。
- [ ] category は非 message target であり、message path と管理 path の扱いが docs と一致している。
- [ ] `LIN-942` / `LIN-943` が追加質問なしで着手できる。

## Constraints
- Perf: 既存 channel list API の shape を大きく崩さず、後続実装で N+1 を生まない契約にする。
- Security: category create / rename / delete / child create は fail-close で `Manage` 相当必須。cross-guild / invalid parent / nested category は reject。
- Compatibility: additive change を優先し、event schema や thread runtime には波及させない。
