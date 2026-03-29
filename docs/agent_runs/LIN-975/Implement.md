# Implement.md (Runbook)

- Follow Plan.md as the single execution order. If order changes are needed, document the reason in Documentation.md and update it.
- Keep diffs small and do not mix in out-of-scope improvements.
- Run validation after each milestone and fix failures immediately before continuing.
- Continuously update Documentation.md with decisions, progress, demo steps, and known issues.

## LIN-975 execution notes

1. Keep ADR-003 as the consistency / reindex SSOT and avoid changing search semantics in this issue.
2. Use the existing standard-path module pattern:
   - environment-scoped Terraform module
   - Secret Manager inventory
   - secret-level accessor IAM for approved Workload Identity GSAs
3. Fix the hosting decision in favor of `Elastic Cloud` and document why `OpenSearch self-managed` is deferred.
4. Add optional search probe targets to the standard observability baseline so the dependency dashboard can show search reachability when enabled.
5. Put runtime query / indexing smoke, snapshot / restore, and vendor boundary in the standard search runbook.
6. Validate Terraform first, then repo-wide validation, then prepare PR + Linear evidence.
