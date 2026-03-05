# LIN-862 SpiceDB 権限モデル設計契約（namespace/relation/permission）

## Purpose

- target issue: LIN-862
- LIN-861 の API 棚卸し/権限マトリクスを入力として、SpiceDB の `namespace/relation/permission` を固定する。
- LIN-632 / LIN-633 の Postgres -> tuple 変換契約と整合する評価モデルを定義する。
- ADR-004 fail-close 契約（deny/unavailable 分離）と矛盾しない判定方針を固定する。

## Scope

In scope:
- SpiceDB schema proposal（`user`/`role`/`guild`/`channel`/`session`/`api_path`）
- role / channel role override / channel user override を含む permission 設計
- LIN-861 matrix と LIN-632/633 契約からの写像ルール
- deny / unavailable 分離の判定規約

Out of scope:
- SpiceDB サーバー構築、運用設定
- Authorizer の実装切替（LIN-865）
- Tuple 同期実装（LIN-864）

## 1. SpiceDB schema proposal (Zed)

```zed
definition user {}

definition role {
  relation member: user
}

definition guild {
  relation owner: user
  relation manager: role#member
  relation viewer: role#member
  relation poster: role#member

  permission can_manage = owner + manager
  permission can_view = owner + viewer + manager
  permission can_post = owner + poster + manager
}

definition channel {
  relation guild: guild

  relation viewer_role: role#member
  relation view_deny_role: role#member
  relation poster_role: role#member
  relation post_deny_role: role#member

  relation viewer_user: user
  relation view_deny_user: user
  relation poster_user: user
  relation post_deny_user: user

  permission role_view_allow = (guild->can_view + viewer_role) - view_deny_role
  permission user_view_allow = viewer_user - view_deny_user
  permission can_view = user_view_allow + (role_view_allow - view_deny_user)

  permission role_post_allow = (guild->can_post + poster_role) - post_deny_role
  permission user_post_allow = poster_user - post_deny_user
  permission can_post = user_post_allow + (role_post_allow - post_deny_user)

  permission can_manage = guild->can_manage
}

definition session {
  relation connector: user
  permission can_connect = connector
}

definition api_path {
  relation viewer: user
  permission can_view = viewer
}
```

## 2. Evaluation semantics (fail-close compatible)

### 2.1 Precedence for channel View/Post

`can_view` / `can_post` は以下の優先順を満たす:

1. user explicit deny
2. user explicit allow
3. role explicit deny
4. role explicit allow
5. role default allow（guild role baseline）
6. default deny

この優先順は LIN-633 契約の評価順と一致する。

### 2.2 Deny vs Unavailable

- SpiceDB check result:
  - `HAS_PERMISSION` -> allow
  - `NO_PERMISSION` -> deterministic deny
- 判定不能（例: timeout / transport failure / dependency unavailable）:
  - unavailable
  - fail-close（allow へ倒さない）

REST/WS の最終マッピングは ADR-004 を適用する:
- deny: REST `403` / WS `1008` / `AUTHZ_DENIED`
- unavailable: REST `503` / WS `1011` / `AUTHZ_UNAVAILABLE`

## 3. Mapping from LIN-861 API matrix

### 3.1 Current protected endpoints

| API surface | LIN-861 resource/action | SpiceDB object | Permission | Tuple strategy |
| --- | --- | --- | --- | --- |
| WS handshake / reauth | `Session + Connect` | `session:global` | `can_connect` | contextual tuple: `session:global#connector@user:{principal_id}` |
| `GET /v1/protected/ping` | `RestPath(/v1/protected/ping) + View` | `api_path:/v1/protected/ping` | `can_view` | contextual tuple: `api_path:/v1/protected/ping#viewer@user:{principal_id}` |

### 3.2 Future domain APIs

- Guild管理: `guild:{guild_id}#can_manage`
- Channel閲覧/投稿: `channel:{channel_id}#can_view` / `#can_post`
- Message/Invite/DM/Moderation は LIN-866/LIN-867 で resource/action マッピングを追加する。

## 4. Alignment with LIN-632 / LIN-633 contracts

### 4.1 Postgres -> tuple (canonical relation names)

| Source | Condition | Tuple |
| --- | --- | --- |
| `guild_member_roles_v2` | row exists | `role:{guild_id}/{role_key}#member@user:{user_id}` |
| `guild_roles_v2` | `allow_manage = true` | `guild:{guild_id}#manager@role:{guild_id}/{role_key}` |
| `guild_roles_v2` | `allow_view = true` | `guild:{guild_id}#viewer@role:{guild_id}/{role_key}` |
| `guild_roles_v2` | `allow_post = true` | `guild:{guild_id}#poster@role:{guild_id}/{role_key}` |
| `channel_role_permission_overrides_v2` | `can_view = true` | `channel:{channel_id}#viewer_role@role:{guild_id}/{role_key}` |
| `channel_role_permission_overrides_v2` | `can_view = false` | `channel:{channel_id}#view_deny_role@role:{guild_id}/{role_key}` |
| `channel_role_permission_overrides_v2` | `can_post = true` | `channel:{channel_id}#poster_role@role:{guild_id}/{role_key}` |
| `channel_role_permission_overrides_v2` | `can_post = false` | `channel:{channel_id}#post_deny_role@role:{guild_id}/{role_key}` |
| `channel_user_permission_overrides_v2` | `can_view = true` | `channel:{channel_id}#viewer_user@user:{user_id}` |
| `channel_user_permission_overrides_v2` | `can_view = false` | `channel:{channel_id}#view_deny_user@user:{user_id}` |
| `channel_user_permission_overrides_v2` | `can_post = true` | `channel:{channel_id}#poster_user@user:{user_id}` |
| `channel_user_permission_overrides_v2` | `can_post = false` | `channel:{channel_id}#post_deny_user@user:{user_id}` |

Rule:
- tri-state `NULL` は tuple を生成しない（継承）。

### 4.2 Legacy tuple naming compatibility

LIN-632 / LIN-633 文書内の `viewer` / `view_deny` / `poster` / `post_deny` は
論理表現として維持し、LIN-864 tuple同期実装で canonical relation 名へ変換する。

## 5. Validation scenarios (design review)

1. user allow + role deny のケースで `can_view` は allow（ただし user deny があれば deny）。
2. role deny のみのケースで `can_view` は deny。
3. role default allow（guild role baseline）のみのケースで `can_view` は allow。
4. SpiceDB timeout/transport error を unavailable として扱い、fail-open しない。
5. LIN-861 の現行 protected endpoint 2ケース（WS/session, protected ping）が object/permission に写像可能である。

## 6. Compatibility policy

- 本Issueは設計契約の追加のみであり、既存ランタイムの公開I/Fを変更しない。
- additive only（破壊的変更なし）。
