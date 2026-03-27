# LIN-950 v2 Server Role / Channel Permission / AuthZ Contract

## Purpose

- target issue: LIN-950
- `LIN-949` の後続実装が迷わないよう、v2 最小スコープの server role / member role assignment / channel permission override / SpiceDB AuthZ 接続点を固定する。
- 既存の `guild_roles_v2` / `guild_member_roles_v2` / `channel_role_permission_overrides_v2` / `channel_user_permission_overrides_v2` を SoR のまま使い、破壊的な schema 追加なしで進める。

## Scope

In scope:
- server role CRUD / reorder の最小契約
- member role assignment の最小契約
- channel role/user override の read/write 契約
- system role 保護、owner lock-out 防止、cross-guild 拒否
- `View/Post/Manage` と endpoint/UI の写像
- invalidation / tuple sync / permission snapshot の反映経路

Out of scope:
- Discord full permission bitset
- `color` / `hoist` / `mentionable` の backend 永続化
- 新しい system role や新規 permission column の追加
- voice/forum/thread/stage など別ドメイン固有の permission surface

## 1. Minimal role model baseline

### 1.1 Role fields

v2 minimal scope で backend が扱う role field は以下に固定する。

- `role_key`
- `name`
- `priority`
- `allow_view`
- `allow_post`
- `allow_manage`
- `is_system`
- `member_count`（read only）

Notes:
- `color` / `hoist` / `mentionable` / Discord bitset `permissions` は今回の backend 契約に含めない。
- frontend は未対応 metadata を hidden または read-only fallback とし、保存対象に含めない。

### 1.2 System role baseline

system role は既存 seed に合わせて以下で固定する。

- `owner`
- `admin`
- `member`

Rule:
- `member` は UI では必要に応じて `@everyone` と表示してよい。
- backend の canonical key は `member` のままとする。
- v2 minimal scope では system role は read-only とする。
  - rename 不可
  - delete 不可
  - reorder 不可
  - `allow_view` / `allow_post` / `allow_manage` 変更不可

### 1.3 Role mutability

- custom role のみ create / update / delete / reorder を許可する。
- create 時の `role_key` は client 入力ではなく backend 生成とする。
  - source: `name` を slug 化
  - collision 時は連番 suffix を付与
- update で変更可能なのは `name` / `allow_view` / `allow_post` / `allow_manage` のみとする。
- `priority` は reorder API でのみ更新する。

## 2. Member assignment baseline

- guild member の role assignment は `guild_member_roles_v2` を SoR とする。
- write API は full replacement 方式で固定する。
  - caller は対象 member の最終 `role_keys[]` を送る
  - server が差分計算して assign/revoke を行う
- validation:
  - `member` は guild member から外せない
  - guild owner から `owner` を外せない
  - guild owner 以外へ `owner` を付与できない
  - role は同一 guild 所属のみ指定可能
  - unknown role / non-member / cross-guild は validation or forbidden で fail-close

## 3. Channel permission override baseline

- channel override は channel 全体の replacement write 方式で固定する。
- request/response は role override と user override を同一 payload で扱う。

### 3.1 Override state

transport value は以下に固定する。

- `allow`
- `deny`
- `inherit`

DB mapping:
- `allow` -> `TRUE`
- `deny` -> `FALSE`
- `inherit` -> `NULL`

### 3.2 Evaluation precedence

`View` / `Post` の評価順は既存契約を維持する。

1. user explicit deny
2. user explicit allow
3. role explicit deny
4. role explicit allow
5. role default (`allow_view` / `allow_post`)
6. default deny

## 4. Planned REST API family

### 4.1 Role APIs

- `GET /v1/guilds/{guild_id}/roles`
- `POST /v1/guilds/{guild_id}/roles`
- `PATCH /v1/guilds/{guild_id}/roles/{role_key}`
- `DELETE /v1/guilds/{guild_id}/roles/{role_key}`
- `PUT /v1/guilds/{guild_id}/roles/reorder`

Response baseline:

```json
{
  "roles": [
    {
      "role_key": "member",
      "name": "Member",
      "priority": 100,
      "allow_view": true,
      "allow_post": true,
      "allow_manage": false,
      "is_system": true,
      "member_count": 42
    }
  ]
}
```

Reorder baseline:
- request body は custom role の ordered `role_keys[]` を送る
- server は pinned system role（`owner > admin > member`）を維持しつつ custom role priority を再計算する

### 4.2 Member role assignment APIs

- `GET /v1/guilds/{guild_id}/members`
- `PUT /v1/guilds/{guild_id}/members/{member_id}/roles`

Assignment write baseline:

```json
{
  "role_keys": ["member", "moderator"]
}
```

### 4.3 Channel permission APIs

- `GET /v1/guilds/{guild_id}/channels/{channel_id}/permissions`
- `PUT /v1/guilds/{guild_id}/channels/{channel_id}/permissions`

Payload baseline:

```json
{
  "role_overrides": [
    {
      "role_key": "member",
      "can_view": "allow",
      "can_post": "deny"
    }
  ],
  "user_overrides": [
    {
      "user_id": 2001,
      "can_view": "inherit",
      "can_post": "allow"
    }
  ]
}
```

Notes:
- `GET` response は UI 用の `subject_name` / `is_system` などの read field を追加してよい。
- `PUT` は channel 内の managed subjects を replacement 更新し、未送信 subject は row 削除または全 `inherit` 扱いへ正規化する。

## 5. AuthZ mapping baseline

### 5.1 Required action mapping

- role management APIs: `AuthzResource::Guild { guild_id } + Manage`
- member role assignment APIs: `AuthzResource::Guild { guild_id } + Manage`
- channel permission APIs: `AuthzResource::GuildChannel { guild_id, channel_id } + Manage`
- existing channel/message operations:
  - view -> `View`
  - post -> `Post`
  - create/edit/delete/settings -> `Manage`

### 5.2 Permission snapshot alignment

- permission snapshot の boolean contract は `LIN-925` / `LIN-926` を維持する。
- v2 scope で追加 UI は snapshot の既存 boolean だけを利用する。
  - settings route / role management / member role assignment -> `guild.can_manage_settings`
  - channel permission editor -> `channel.can_manage`
- frontend は role bitset をローカル解釈しない。

### 5.3 Fail-close behavior

ADR-004 に従い、以下を維持する。

- deterministic deny -> `403 / AUTHZ_DENIED`
- dependency unavailable -> `503 / AUTHZ_UNAVAILABLE`
- WS deny -> `1008`
- WS unavailable -> `1011`

## 6. Persistence and propagation baseline

- SoR:
  - `guild_roles_v2`
  - `guild_member_roles_v2`
  - `channel_role_permission_overrides_v2`
  - `channel_user_permission_overrides_v2`
- role / assignment / override 変更後は以下の両方へ接続する。
  - AuthZ cache invalidation
  - SpiceDB tuple sync 用 outbox event

Required invalidation kind:
- `guild_role_changed`
- `guild_member_role_changed`
- `channel_role_override_changed`
- `channel_user_override_changed`

Tuple sync family:
- `authz.tuple.guild_role.v1`
- `authz.tuple.guild_member_role.v1`
- `authz.tuple.channel_role_override.v1`
- `authz.tuple.channel_user_override.v1`

Rule:
- write transaction が commit された変更だけを invalidation / tuple sync 対象とする。
- invalidation / tuple sync の一部失敗は silent ignore せず、後続 issue で retry / observability を保証する。

## 7. Frontend compatibility baseline

- `ServerRoles` は current mock `Role` shape から最小 DTO へ移行する。
- `ServerMembers` は `role_keys[]` を SSOT とし、role label は role list query で解決する。
- `ChannelEditPermissions` は `allow|deny|inherit` を transport value とし、bitset 由来の permission UI は持ち込まない。
- UI label:
  - backend `member` -> UI `@everyone`
  - `owner` / `admin` / custom role はそのまま表示

## 8. Explicit non-goals for follow-up issues

- system role の mutable 化
- full Discord permission matrix
- `member` と別の dedicated `everyone` role 新設
- `color` / `hoist` / `mentionable` backend persistence

## 9. Validation

Docs/contract issue の最小検証:

```bash
make validate
make rust-lint
cd typescript && npm run typecheck
```
