## Rules
- Stop-and-fix: 検証またはreview gateで失敗したら次Issueへ進まず修正する。
- 1 issue = 1 PR を維持する。

## Milestones
### M1: Parent run初期化
- Acceptance criteria:
  - [x] LIN-869 を In Progress 化
  - [x] メモリ4ファイル作成
- Validation:
  - `git status`

### M2: LIN-873 relation/tuple整合
- Acceptance criteria:
  - [x] lin862/lin864契約整合
  - [x] channel#guild tuple生成
  - [x] 回帰テスト追加
- Validation:
  - `make rust-lint`
  - `cargo test -p linklynx_backend tuple_mapping_uses_canonical_relations`
  - `cargo test -p linklynx_backend tuple_sync_service_executes_full_resync_event`

### M3: LIN-883 full_resync収束性
- Acceptance criteria:
  - [x] stale tuple削除
  - [x] mark_sent失敗耐性
- Validation:
  - `make rust-lint`
  - `cargo test -p linklynx_backend tuple_sync_service_`

### M4: LIN-875 tuple_sync validation
- Acceptance criteria:
  - [x] partial payload拒否
  - [x] 0値設定拒否
- Validation:
  - `make rust-lint`
  - `cargo test -p linklynx_backend tuple_sync_service_processes_outbox_successfully`

### M5: LIN-874 authz cache invalidation
- Acceptance criteria:
  - [x] invalidation event即時evict
  - [x] max entries導入
- Validation:
  - `make rust-lint`
  - `cargo test -p linklynx_backend runtime_provider_spicedb_`

### M6: LIN-882 guild整合チェック
- Acceptance criteria:
  - [ ] cross-guild deny
- Validation:
  - `make rust-lint`
  - `cargo test -p linklynx_backend guild_channel_`

### M7: LIN-881 WS/Internal authz bypass解消
- Acceptance criteria:
  - [ ] WS text経路認可境界統一
  - [ ] /internal/authz/metrics保護
- Validation:
  - `make rust-lint`
  - `cargo test -p linklynx_backend ws_`

### M8: LIN-876 runtime reproducibility
- Acceptance criteria:
  - [ ] SpiceDB image pin
  - [ ] CI契約チェック追加
- Validation:
  - `make rust-lint`

### M9: LIN-884 CI gate hardening
- Acceptance criteria:
  - [ ] name-filter誤緑防止
  - [ ] env validation回帰
- Validation:
  - `make validate`
  - `cargo test -p linklynx_backend runtime_provider_spicedb_`
