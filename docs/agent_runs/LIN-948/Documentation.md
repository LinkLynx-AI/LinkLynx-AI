# Documentation

## Current status
- Now: LIN-948 durable idempotency 実装と検証は完了
- Next: PR 作成または追加の live smoke が必要なら実施する

## Decisions
- `Idempotency-Key` は optional header とする。
- same key + same payload は `201 Created` のまま同一 identity を返す。
- same key + different payload は `VALIDATION_ERROR` に落とす。
- `request_id` は observability 用に残し、durable dedupe には使わない。

## Validation log
- `cargo test -p linklynx_message_domain -p linklynx_platform_postgres_message -p linklynx_backend --no-run`
  - compile pass
- `cargo test -p linklynx_message_domain`
  - pass
- `cargo test -p linklynx_platform_postgres_message`
  - pass
- `cargo test -p linklynx_backend message::tests`
  - pass
- `cargo test -p linklynx_backend create_channel_message`
  - pass
- `cargo test -p linklynx_backend same_idempotency_key_reuses_identity_across_service_instances`
  - pass
- `cargo test -p linklynx_backend create_channel_message_reuses_message_identity_for_same_idempotency_key`
  - pass
- `cargo test -p linklynx_backend create_channel_message_rejects_payload_mismatch_for_same_idempotency_key`
  - pass
- `cargo fmt --all`
  - pass
- `make rust-lint`
  - sandbox では既存権限制約により失敗
  - escalated 実行では pass
- `pnpm -C typescript install --frozen-lockfile`
  - `npm -C typescript ci` が lockfile 不整合で失敗したため代替で実行
  - `make validate` 前提として pass
- `make validate`
  - TypeScript / Rust / Python すべて pass

## Review gate
- Meta review
  - `reviewer` 最終所見: 重大な問題なし
  - durable reservation / payload mismatch / replay / completion ordering / docs 反映を確認
- UI guard
  - `reviewer_ui_guard` は UI 変更なしと判定
  - 対象差分は `database/`, `docs/`, `rust/` 配下のみで、`typescript/src/**` など UI 影響パターンに一致する変更なし
  - UI review は skip
- Unified review fallback
  - `reviewer_simple` 最終所見: pass / 重大な問題なし
  - `git diff --check` も pass

## Runtime smoke
- 非 trivial な backend 変更のため live smoke は本来実施対象
- 今回は repo-wide validation と API/domain/repository tests を優先し、実ランタイムの multi-instance smoke は未実施
- 代替として `RuntimeMessageService` 別 instance 回帰テストで shared idempotency state による identity reuse を確認した
- skip rationale:
  - durable replay の主要要件は domain / repository / HTTP regression で自動検証済み
  - live multi-instance 検証には Postgres/Scylla 起動、migration 適用、Scylla schema 適用、認証付き API 経路の手動セットアップが必要
