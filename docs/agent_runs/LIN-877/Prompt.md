# Prompt.md (Spec / Source of truth)

## Goals
- Implement `PATCH /guilds/{guild_id}` for minimal server edit (`name`, `icon_key`).
- Enforce fail-close authorization for server update boundary (owner/admin-manage only).
- Connect server settings UI to real API and show success/failure states.
- Reflect updated server name on server rail immediately without waiting for refetch.

## Non-goals
- Server delete flow.
- Permission model redesign.
- Category/thread feature changes.
- Full image upload flow for icon.

## Deliverables
- Backend endpoint, service method, postgres implementation, and tests.
- Frontend API client/update mutation/server settings wiring and tests.
- Validation and review evidence in Documentation.md.

## Done when
- [x] Authorized user can update server name and see immediate rail update.
- [x] Unauthorized update request is denied with fail-close contract.
- [x] Validation reason is shown in FE for blank/too-long name and UI remains stable.
- [x] Structured logs cover success/denied/validation invalid input paths.

## Constraints
- Perf: no full list reload requirement for immediate visual update.
- Security: follow ADR-004 fail-close semantics.
- Compatibility: preserve existing error-code contract.
