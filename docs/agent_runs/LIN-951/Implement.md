# Implement

- Follow `Plan.md` as the single execution order. If order changes are needed, record the reason in `Documentation.md`.
- Reuse `user_directory` as the API/service boundary unless a hard blocker appears.
- Keep write logic transactional and co-locate validation with persistence where possible.
- Reuse existing invalidation kinds and tuple event types:
  - `guild_role_changed`
  - `guild_member_role_changed`
  - `channel_role_override_changed`
  - `channel_user_override_changed`
  - `authz.tuple.guild_role.v1`
  - `authz.tuple.guild_member_role.v1`
  - `authz.tuple.channel_role_override.v1`
  - `authz.tuple.channel_user_override.v1`
- Before closing the issue, ensure these contract points are enforced in code:
  - system role (`owner/admin/member`) is read-only
  - backend canonical role key stays `member`
  - custom role reorder keeps pinned system role order
  - replacement writes normalize missing overrides to deletion / inherit
