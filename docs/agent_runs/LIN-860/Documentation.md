# LIN-860 Documentation Log

## Status
- In progress.
- Current child issue: `LIN-864`.

## Decisions
- Parent/child execution order follows LIN-860 definition (`861 -> 868`).
- Child PR base branch is `codex/lin-860`.
- Run memory location is `docs/agent_runs/LIN-860/`.

## LIN-861 progress
- branch: `codex/LIN-861-authz-api-inventory`
- objective: API棚卸し、`principal/resource/action` マトリクス固定、Public/Protected境界確定
- delivered:
  - `docs/AUTHZ_API_MATRIX.md`（新規）
  - `docs/AUTHZ.md` への参照追加

## Validation results (LIN-861)
- `make validate`: failed（`typescript` の `node_modules` 未導入により `prettier: command not found`）
- `make rust-lint`: passed

## Review results (LIN-861)
- `reviewer_simple`: unavailable in current execution environment（agent type unavailable）
- Manual self-review fallback:
  - 追加内容は `docs/*` と runメモリのみで、実装コード変更なし
  - AuthZ契約（ADR-004 fail-close）と矛盾する変更なし
  - blocking findings: none
- `reviewer_ui_guard`: unavailable in current execution environment（agent type unavailable）
- UI gate fallback:
  - changed files are docs only, no frontend/UI files
  - `reviewer_ui`: skipped（UI changesなし）

## Per-child evidence (LIN-861)
- issue: `LIN-861`
- branch: `codex/LIN-861-authz-api-inventory`
- validation commands and results:
  - `make validate`: failed（environment dependency missing）
  - `make rust-lint`: passed
- reviewer gate (`reviewer_simple`): unavailable -> manual self-review fallback (no blocking findings)
- UI gate (`reviewer_ui_guard` / `reviewer_ui`): unavailable -> UI changesなしで `reviewer_ui` skipped
- PR URL: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1029
- PR base branch: `codex/lin-860`
- merge/auto-merge status: merged (`2026-03-04T05:27:48Z`)

## LIN-862 progress
- branch: `codex/LIN-862-spicedb-authz-model-design`
- objective: SpiceDB namespace/relation/permission 設計を LIN-861 matrix と LIN-632/633 契約に整合させて固定
- delivered:
  - `database/contracts/lin862_spicedb_namespace_relation_permission_contract.md`（新規）
  - `docs/AUTHZ.md` / `docs/DATABASE.md` の参照更新
  - `database/contracts/lin632_spicedb_role_model_migration_contract.md` と `database/contracts/lin633_channel_user_override_spicedb_contract.md` への整合注記追加

## Validation results (LIN-862)
- `make validate`: failed（`typescript` の `node_modules` 未導入により `prettier: command not found`）
- `make rust-lint`: passed

## Review results (LIN-862)
- `reviewer_simple`: unavailable in current execution environment（agent type unavailable）
- Manual self-review fallback:
  - SpiceDB schema proposal が LIN-861 matrix の current protected endpoint を `session` / `api_path` でカバー
  - LIN-632 / LIN-633 契約との関係を canonical relation 名で明文化
  - ADR-004 deny/unavailable 境界と fail-close を設計契約に明記
  - blocking findings: none
- `reviewer_ui_guard`: unavailable in current execution environment（agent type unavailable）
- UI gate fallback:
  - changed files are docs/contracts only, no frontend/UI files
  - `reviewer_ui`: skipped（UI changesなし）

## Per-child evidence (LIN-862)
- issue: `LIN-862`
- branch: `codex/LIN-862-spicedb-authz-model-design`
- validation commands and results:
  - `make validate`: failed（environment dependency missing）
  - `make rust-lint`: passed
- reviewer gate (`reviewer_simple`): unavailable -> manual self-review fallback (no blocking findings)
- UI gate (`reviewer_ui_guard` / `reviewer_ui`): unavailable -> UI changesなしで `reviewer_ui` skipped
- PR URL: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1030
- PR base branch: `codex/lin-860`
- merge/auto-merge status: merged (`2026-03-04T05:35:26Z`)

## LIN-863 progress
- branch: `codex/LIN-863-spicedb-runtime-foundation`
- objective: SpiceDB local/CI 実行基盤（設定・環境変数・ヘルスチェック）を整備し、再現可能な手順を固定
- delivered:
  - `docker-compose.yml` に `spicedb` service と Rust runtime env baseline を追加
  - `.env.example` に AuthZ/SpiceDB runtime env を追加
  - `Makefile` に `authz-spicedb-up/down/health` を追加
  - `.github/workflows/ci.yml` に SpiceDB runtime foundation job を追加
  - `rust/apps/api/src/authz/runtime.rs` に SpiceDB runtime config 構築/検証を追加
  - `rust/apps/api/src/authz/tests.rs` に SpiceDB runtime config テストを追加
  - `docs/runbooks/authz-spicedb-local-ci-runtime-runbook.md` を新規追加
  - `docs/runbooks/README.md` / `README.md` / `docs/AUTHZ.md` を更新

## Validation results (LIN-863)
- `make validate`: failed（`typescript` の `node_modules` 未導入により `prettier: command not found`）
- `make rust-lint`: passed

## Review results (LIN-863)
- `reviewer_simple`: unavailable in current execution environment（agent type unavailable）
- Manual self-review fallback:
  - runtime env 契約（required/optional/default）と misconfiguration 挙動を `authz/runtime.rs` + runbook で整合
  - CI job で SpiceDB gRPC endpoint の到達性チェックを追加
  - Rustテスト追加で runtime config parse/required key を固定
  - blocking findings: none
- `reviewer_ui_guard`: unavailable in current execution environment（agent type unavailable）
- UI gate fallback:
  - frontend/UI変更なし
  - `reviewer_ui`: skipped（UI changesなし）

## Per-child evidence (LIN-863)
- issue: `LIN-863`
- branch: `codex/LIN-863-spicedb-runtime-foundation`
- validation commands and results:
  - `make validate`: failed（environment dependency missing）
  - `make rust-lint`: passed
- reviewer gate (`reviewer_simple`): unavailable -> manual self-review fallback (no blocking findings)
- UI gate (`reviewer_ui_guard` / `reviewer_ui`): unavailable -> UI changesなしで `reviewer_ui` skipped
- PR URL: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1031
- PR base branch: `codex/lin-860`
- merge/auto-merge status: merged (`2026-03-04T05:48:16Z`)

## LIN-864 progress
- branch: `codex/LIN-864-postgres-spicedb-tuple-sync`
- objective: Postgres `*_v2` 権限データから canonical SpiceDB tuple への写像、initial backfill、outbox差分同期、失敗検知/再同期フックの実装
- delivered:
  - `rust/apps/api/src/authz/tuple_sync.rs`（新規）
    - canonical relation tuple mapping
    - backfill input/report 生成
    - outbox event -> tuple mutation 変換
    - `claim_outbox_events` / `mark_*` を使う同期サービス
    - metrics snapshot と full resync hook (`authz.tuple.full_resync.v1`)
  - `rust/apps/api/src/authz.rs`
    - `tuple_sync` サブモジュール導入と再エクスポート
  - `rust/apps/api/src/authz/runtime.rs`
    - `AUTHZ_PROVIDER=spicedb` 時の tuple sync runtime config 検証ログ追加
  - `rust/apps/api/src/authz/tests.rs`
    - tuple mapping/backfill/delta sync/failure/full resync のテスト追加
  - `database/contracts/lin864_postgres_spicedb_tuple_sync_contract.md`（新規）
  - `docs/runbooks/authz-spicedb-tuple-sync-operations-runbook.md`（新規）
  - `docs/AUTHZ.md` / `docs/DATABASE.md` / `docs/runbooks/README.md` / `.env.example` 更新

## Validation results (LIN-864)
- `make rust-lint`: passed
- `make validate`: failed（`typescript` の `node_modules` 未導入により `prettier: command not found`）

## Review results (LIN-864)
- `reviewer_simple`: unavailable in current execution environment（agent type unavailable / subagent model unsupported）
- Manual self-review fallback:
  - tuple mapping が LIN-862 canonical relation 名に一致することを Rust テストで固定
  - outbox差分同期の success/failure/full-resync 経路をテストで固定
  - 同期失敗時の `mark_outbox_event_failed` と metrics 増分を確認
  - blocking findings: none
- `reviewer_ui_guard`: unavailable in current execution environment（agent type unavailable）
- UI gate fallback:
  - frontend/UI変更なし
  - `reviewer_ui`: skipped（UI changesなし）

## Per-child evidence (LIN-864)
- issue: `LIN-864`
- branch: `codex/LIN-864-postgres-spicedb-tuple-sync`
- validation commands and results:
  - `make rust-lint`: passed
  - `make validate`: failed（environment dependency missing）
- reviewer gate (`reviewer_simple`): unavailable -> manual self-review fallback (no blocking findings)
- UI gate (`reviewer_ui_guard` / `reviewer_ui`): unavailable -> UI changesなしで `reviewer_ui` skipped
- PR URL: not created yet（`gh auth status` reports invalid token on this environment）
- PR base branch: `codex/lin-860`（planned）
- merge/auto-merge status: pending（PR未作成）
