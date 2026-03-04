# LIN-860 Documentation Log

## Status
- In progress.
- Current child issue: `LIN-861`.

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
- PR URL: pending
- PR base branch: `codex/lin-860`
- merge/auto-merge status: pending
