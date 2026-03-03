# LIN-633 Implement Rules

- 既存 `channel_permission_overrides` / `channel_role_permission_overrides_v2` は削除しない。
- user override は additive に追加し、移行期間は role/user 併存を許容する。
- 優先順の契約は ADR-004 fail-close と矛盾しないこと。
- schema変更時は `schema.sql` と `database/postgres/generated` を再生成する。
