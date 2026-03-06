## Current status
- Now: LIN-874 実装/検証/review loop 完了、親branch取り込み待ち。
- Next: LIN-882 を開始。

## Decisions
- Parent issue LIN-869 was moved to In Progress before execution.
- Child issue execution order fixed: 873 -> 883 -> 875 -> 874 -> 882 -> 881 -> 876 -> 884.
- Reviewer loop exit: no P1+ findings, max 2 retries.
- Merge mode: child branch changes are merged into parent branch after gate pass.

## How to run / demo
- Parent working branch: `codex/lin-869-patch-spicedb_review_result`
- Progress logs will be appended per child issue.

## Known issues / follow-ups
- `make validate` は `typescript` 側 `node_modules` 未導入により `prettier: command not found` で失敗（`make rust-lint` と対象Rustテストは通過）。

## LIN-873 progress
- Branch: `codex/LIN-873-relation-tuple-alignment`
- Scope: relation/tuple契約整合、`channel#guild` tuple生成をbackfill/delta(upsert)へ追加
- Validation:
  - `cd rust && cargo test -p linklynx_backend tuple_mapping_uses_canonical_relations` (pass)
  - `cd rust && cargo test -p linklynx_backend tuple_sync_service_executes_full_resync_event` (pass)
  - `cd rust && cargo test -p linklynx_backend tuple_sync_command_channel_override_upsert_includes_channel_guild_tuple` (pass)
  - `make rust-lint` (pass)
- Review gate:
  - reviewer: pass (P1+ findingsなし)
  - reviewer_ui_guard: skipped (backend/docs-only diff)

## LIN-883 progress
- Branch: `codex/LIN-883-full-resync-convergence`
- Scope: full_resync を drift 収束モデルへ更新、`mark_outbox_event_sent` 失敗時の retry 復旧を追加
- Validation:
  - `make rust-lint` (pass)
  - `cd rust && cargo test -p linklynx_backend tuple_sync_service_` (pass)
- Review gate:
  - reviewer: pass（初回P1を修正後、再reviewでblocking解消）
  - reviewer_ui_guard: skipped（backend/docs-only diff）

## LIN-875 progress
- Branch: `codex/LIN-875-tuple-sync-validation-hardening`
- Scope: partial payload 拒否と tuple sync env 0値拒否の実装
- Validation:
  - `make rust-lint` (pass)
  - `cd rust && cargo test -p linklynx_backend tuple_sync_service_processes_outbox_successfully` (pass)
- Review gate:
  - reviewer_simple: pass（P1+なし）
  - reviewer_ui_guard: skipped（backend/docs-only diff）

## LIN-874 progress
- Branch: `codex/LIN-874-authz-cache-invalidation`
- Scope:
  - AuthZ cache invalidation event API（即時evict）実装
  - cache max entries（LRU近似: oldest inserted eviction）導入
  - invalidation lag / evict件数の計測と取得
  - `AUTHZ_CACHE_MAX_ENTRIES` 環境変数導入（0拒否）
  - 保護ルート `/internal/authz/cache/invalidate` 追加
- Validation:
  - `make rust-lint` (pass)
  - `cd rust && cargo test -p linklynx_backend runtime_provider_spicedb_` (pass)
  - `make validate` (fail: prettier not found / node_modules missing)
- Review gate:
  - reviewer: pass（初回P1: internal invalidate POSTのaction mapping不整合を修正済み）
  - reviewer_ui_guard: failed（model unsupported）。backend-only差分のためUI reviewはskip記録
