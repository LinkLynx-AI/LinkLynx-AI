# LIN-632 Implement Rules

- 既存テーブル（`guild_roles` / `guild_member_roles` / `channel_permission_overrides`）は即時削除しない。
- 新モデルは V2 テーブルとして additive に追加し、後続Issueで段階移行できる形にする。
- migration は append-only とし、既存 migration は編集しない。
- `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md` と矛盾する fail-open 契約を導入しない。
