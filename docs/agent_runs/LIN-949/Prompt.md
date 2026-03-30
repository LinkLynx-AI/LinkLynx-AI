# Prompt.md (Spec / Source of truth)

## Goals
- Resolve the open PR conflict on `codex/lin-949` against `main` without changing the approved LIN-949 scope.
- Preserve the child-issue deliverables already merged into the parent branch.
- Keep AuthZ fail-close, database contract, and frontend/backend wiring aligned with repository docs.

## Non-goals
- Do not add new features beyond conflict resolution and compatibility fixes required for merge.
- Do not refactor unrelated Rust or TypeScript code.
- Do not alter parent/child issue boundaries or reopen completed child scopes.

## Deliverables
- Updated `codex/lin-949` branch that cleanly merges with `main`.
- Conflict resolution notes and validation evidence for the repaired branch.
- Run memory files under `docs/agent_runs/LIN-949/`.

## Done when
- [ ] `codex/lin-949` no longer conflicts with `main`.
- [ ] Relevant Rust/TypeScript/AuthZ changes are reconciled without scope creep.
- [ ] Validation evidence is recorded.

## Constraints
- Perf: avoid unnecessary behavioral changes while resolving conflicts.
- Security: maintain ADR-004 fail-close behavior and existing permission boundaries.
- Compatibility: preserve LIN-949 child-issue outputs and current `main` behavior outside the conflict surface.
