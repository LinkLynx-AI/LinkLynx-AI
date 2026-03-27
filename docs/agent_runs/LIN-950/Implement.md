# Implement

- Follow `Plan.md` as the single execution order. If order changes are needed, record the reason in `Documentation.md`.
- Keep the diff limited to docs and issue-run memory files.
- Preserve current implementation facts in `docs/AUTHZ_API_MATRIX.md`; add LIN-950 content as planned/future baseline instead of rewriting current-state sections.
- Reuse existing terminology:
  - role defaults: `allow_view` / `allow_post` / `allow_manage`
  - channel override tri-state: `allow` / `deny` / `inherit`
  - invalidation kinds: `guild_role_changed`, `guild_member_role_changed`, `channel_role_override_changed`, `channel_user_override_changed`
- Before closing the issue, ensure the docs make these defaults explicit:
  - UI label `@everyone` maps to backend `member`
  - system roles are read-only in v2 minimal scope
  - unsupported metadata (`color` / `hoist` / `mentionable`) stays out of backend scope
