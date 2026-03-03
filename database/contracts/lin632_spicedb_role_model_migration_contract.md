# LIN-632 任意ロール / SpiceDB写像 移行契約

## Purpose

- target issue: LIN-632
- 固定3ロール（`owner/admin/member`）依存から脱却し、1 guild 内で任意ロールを定義可能にする。
- Postgres権限データから SpiceDB tuple へ写像可能な最小データモデルを固定する。
- 移行フェーズ（backfill -> dual-write -> cutover -> rollback）の実行基準を文書化する。

## Scope

In scope:
- `guild_roles_v2`
- `guild_member_roles_v2`
- `channel_role_permission_overrides_v2`
- v0 role-level モデルとの移行互換ルール
- Postgres -> SpiceDB tuple 写像表

Out of scope:
- SpiceDB クライアント実装
- Authorizer判定ロジック全面切替
- APIレスポンス仕様の刷新

## 1. Data model baseline (Postgres)

### 1.1 `guild_roles_v2`

- PK: `(guild_id, role_key)`
- 任意 `role_key` を許可し、`priority` で評価順を定義する。
- `role_key` naming rule:
  - regex: `^[a-z0-9_]{1,64}$`
  - lowercase英数字と`_`のみを許可し、guild内で一意に扱う。
- 標準操作権限を `allow_view` / `allow_post` / `allow_manage` で保持する。
- `source_level` は v0 (`role_level`) からの移行痕跡を保持する。

### 1.2 `guild_member_roles_v2`

- PK: `(guild_id, user_id, role_key)`
- 1 member に複数 role を割り当て可能。
- `guild_members` と `guild_roles_v2` をFKで参照する。
- `assigned_by` は `ON DELETE SET NULL` とし、割当履歴は残しつつ削除済みactorを参照不能にする（監査互換のため）。

### 1.3 `channel_role_permission_overrides_v2`

- PK: `(channel_id, role_key)`
- tri-state override を維持する。
  - `NULL`: ロール既定値継承
  - `TRUE`: 明示許可
  - `FALSE`: 明示拒否
- `guild_id` は `channels.guild_id` と一致必須（triggerで強制）。

## 2. Postgres -> SpiceDB tuple mapping

Tuple namespace examples:
- user subject: `user:{user_id}`
- role subject: `role:{guild_id}/{role_key}`
- guild resource: `guild:{guild_id}`
- channel resource: `channel:{channel_id}`

| Postgres source | Condition | SpiceDB tuple |
| --- | --- | --- |
| `guild_member_roles_v2` | row exists | `role:{guild_id}/{role_key}#member@user:{user_id}` |
| `guild_roles_v2` | `allow_manage = true` | `guild:{guild_id}#manager@role:{guild_id}/{role_key}` |
| `guild_roles_v2` | `allow_view = true` | `guild:{guild_id}#viewer@role:{guild_id}/{role_key}` |
| `guild_roles_v2` | `allow_post = true` | `guild:{guild_id}#poster@role:{guild_id}/{role_key}` |
| `channel_role_permission_overrides_v2` | `can_view = true` | `channel:{channel_id}#viewer@role:{guild_id}/{role_key}` |
| `channel_role_permission_overrides_v2` | `can_view = false` | `channel:{channel_id}#view_deny@role:{guild_id}/{role_key}` |
| `channel_role_permission_overrides_v2` | `can_post = true` | `channel:{channel_id}#poster@role:{guild_id}/{role_key}` |
| `channel_role_permission_overrides_v2` | `can_post = false` | `channel:{channel_id}#post_deny@role:{guild_id}/{role_key}` |

Note:
- `NULL` override は tuple を生成しない（継承扱い）。
- deny tuple の評価優先順は ADR-004 fail-close と整合するよう、allow より先に評価する。

## 3. Migration phases

### Phase 1: backfill

- `0008_lin632_arbitrary_roles_spicedb_prep.up.sql` を適用し、v0テーブルからv2へ初期投入する。
- Completion criteria:
  - `guild_roles` 件数と `guild_roles_v2` の `source_level IS NOT NULL` 件数が一致。
  - `guild_member_roles` 件数と `guild_member_roles_v2` の `role_key IN ('owner','admin','member')` 件数が一致。
  - `channel_permission_overrides` 件数と `channel_role_permission_overrides_v2` 件数が一致（guild channel のみ）。

### Phase 2: dual-write

- 書き込み経路は v0 + v2 の両方を更新する。
- 読み取りは v0 を継続し、比較検証ジョブで差分監視する。
- Completion criteria:
  - 連続7日、差分監視で重大不一致0件。

### Phase 3: cutover

- 読み取りを v2 + tuple変換経路に切り替える。
- v0 は rollback safety のため read-only 保持。
- Completion criteria:
  - `View/Post/Manage` の主要認可ケースで deny/unavailable 契約がADR-004準拠。

### Phase 4: rollback

- Cutover後に重大不整合が発生した場合は v0読み取りへ即時復帰する。
- rollback trigger example:
  - deny/allow 逆転が検知される
  - tuple変換遅延で `AUTHZ_UNAVAILABLE` が許容閾値を超える

## 4. Compatibility policy

- 本Issueでは v0テーブルを削除しない。
- 既存 `role_level` モデルは移行期間のSoRとして残す。
- 破壊的変更は後続Issueで明示的に段階実施する。
- retained permission-related columns/tables in this phase:
  - `guild_roles.level`
  - `guild_member_roles.level`
  - `channel_permission_overrides.level/can_view/can_post`
  - reason: rollback safety と dual-write整合性のため（Phase 2/3完了まで保持）。
- deletion candidates are tracked as post-cutover work, not in LIN-632 scope.

## 5. Validation

```bash
make db-migrate
make db-schema
make db-schema-check
make validate
```

Optional SQL checks:

```sql
SELECT count(*) FROM guild_roles;
SELECT count(*) FROM guild_roles_v2 WHERE source_level IS NOT NULL;

SELECT count(*) FROM guild_member_roles;
SELECT count(*) FROM guild_member_roles_v2 WHERE role_key IN ('owner','admin','member');
```
