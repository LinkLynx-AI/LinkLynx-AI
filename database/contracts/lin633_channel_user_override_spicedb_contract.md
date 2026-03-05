# LIN-633 チャンネル権限上書き（ユーザー単位）/ SpiceDB写像契約

## Purpose

- target issue: LIN-633
- チャンネル権限上書きを role + user の両subjectで表現できるようにする。
- tri-state（allow/deny/inherit）を維持し、評価順序を fail-close 前提で固定する。
- Postgres override データから SpiceDB tuple への変換規約を固定する。

## Scope

In scope:
- `channel_user_permission_overrides_v2`
- `channel_permission_overrides_subject_v2`（role/user統合ビュー）
- role/user override の評価優先順
- role/user override -> tuple 変換規約

Out of scope:
- Authorizer実装本体
- APIレスポンス仕様変更
- UI側権限表示ロジック

## 1. Data model

### 1.1 `channel_user_permission_overrides_v2`

- PK: `(channel_id, user_id)`
- FK: `(guild_id, user_id) -> guild_members(guild_id, user_id)`
- tri-state:
  - `NULL`: 継承
  - `TRUE`: 明示許可
  - `FALSE`: 明示拒否
- `guild_id` と `channels.guild_id` は trigger で一致強制。
- index policy:
  - `idx_channel_user_overrides_v2_user (user_id, guild_id)` for user-centric lookups
  - `idx_channel_user_overrides_v2_guild_user (guild_id, user_id)` for guild-scoped scans

### 1.2 `channel_permission_overrides_subject_v2`

- role override (`channel_role_permission_overrides_v2`) と
  user override (`channel_user_permission_overrides_v2`) を統合する参照ビュー。
- `subject_type`:
  - `role`
  - `user`

## 2. Postgres override -> SpiceDB tuple mapping

Namespace:
- role subject: `role:{guild_id}/{role_key}`
- user subject: `user:{user_id}`
- channel resource: `channel:{channel_id}`

| Source | Condition | Tuple |
| --- | --- | --- |
| role override | `can_view = true` | `channel:{channel_id}#viewer@role:{guild_id}/{role_key}` |
| role override | `can_view = false` | `channel:{channel_id}#view_deny@role:{guild_id}/{role_key}` |
| role override | `can_post = true` | `channel:{channel_id}#poster@role:{guild_id}/{role_key}` |
| role override | `can_post = false` | `channel:{channel_id}#post_deny@role:{guild_id}/{role_key}` |
| user override | `can_view = true` | `channel:{channel_id}#viewer@user:{user_id}` |
| user override | `can_view = false` | `channel:{channel_id}#view_deny@user:{user_id}` |
| user override | `can_post = true` | `channel:{channel_id}#poster@user:{user_id}` |
| user override | `can_post = false` | `channel:{channel_id}#post_deny@user:{user_id}` |

Rule:
- `NULL` は tuple を生成しない（継承）。
- LIN-862 で canonical relation 名（`viewer_user` / `view_deny_user` / `poster_user` / `post_deny_user`）を導入する。
  本表の `viewer` / `view_deny` / `poster` / `post_deny` は論理写像として維持し、LIN-864 tuple同期実装で canonical relation へ変換する。

## 3. Evaluation precedence (fail-close compatible)

`View` / `Post` 判定は次順で固定する。

1. user explicit deny
2. user explicit allow
3. role explicit deny
4. role explicit allow
5. role default (`guild_roles_v2.allow_*`)
6. default deny

Notes:
- 競合時は deny を優先する。
- 必要データが欠落する場合は `deny` または `unavailable` とし、許可へ倒さない（ADR-004準拠）。

## 4. Compatibility policy

- v0テーブル（`channel_permission_overrides`）は移行期間中保持する。
- role-only 設定時は従来どおり role override 経路で判定可能。
- user override は additive で導入し、未設定時の既存挙動を壊さない。

## 5. Validation

```bash
make db-migrate
make db-schema-check
make validate
```

Optional SQL example (role allow + user deny):

```sql
-- role allow
INSERT INTO channel_role_permission_overrides_v2(channel_id, guild_id, role_key, can_view)
VALUES (1001, 10, 'member', TRUE)
ON CONFLICT (channel_id, role_key) DO UPDATE SET can_view = EXCLUDED.can_view;

-- user deny
INSERT INTO channel_user_permission_overrides_v2(channel_id, guild_id, user_id, can_view)
VALUES (1001, 10, 2001, FALSE)
ON CONFLICT (channel_id, user_id) DO UPDATE SET can_view = EXCLUDED.can_view;
```
