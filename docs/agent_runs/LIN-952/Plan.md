# Plan

## Rules
- Stop-and-fix: validation / authz regression 失敗時は次工程へ進まない。
- Scope lock: `LIN-952` は request-time AuthZ 適用と整合性修正に限定し、UI や tuple sync 基盤拡張は混ぜない。

## Milestones
### M1: request-time action/resource mapping を契約へ揃える
- Acceptance criteria:
  - [x] role settings / member assignment / channel permission editor の route が `Manage` 保護になる
  - [x] channel create/edit/delete の route 判定が shared authorizer と一致する
- Validation:
  - `cargo test -p linklynx_backend rest_authz_action_maps_invite_and_message_commands -- --nocapture`
  - Result: pass

### M2: direct DB の manage 依存を server/channel 境界から外す
- Acceptance criteria:
  - [x] `guild_channel` / `user_directory` の対象 path が direct DB manage 判定なしで成立する
  - [x] not found / validation / fail-close のエラー境界が維持される
- Validation:
  - `cargo test -p linklynx_backend create_guild_channel_returns_created_for_category_child -- --nocapture`
  - `cargo test -p linklynx_backend -- --nocapture`
  - Result: pass

### M3: fail-close / snapshot 整合性回帰を固定する
- Acceptance criteria:
  - [x] manage-only GET endpoint の deny/unavailable regression が追加されている
  - [x] permission snapshot と actual operation の可否が shared boundary 前提で確認できる
  - [x] `Documentation.md` に decisions と validation 結果が残っている
- Validation:
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
  - `make authz-spicedb-up && make authz-spicedb-health`
  - `make validate`
  - Result: pass
