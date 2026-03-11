# AuthZ Contract (v1 pre-SpiceDB)

最終更新: 2026-03-04

この文書は `LIN-600` の成果物として、v0 RBAC を v1 AuthZ 入力へ写像する契約を固定する。
本契約は `LIN-602` での導線実装（Authorizer境界 + noop allow-all）を直接着手可能にするための最小セットである。

## 1. Scope

### In scope
- `principal / resource / action` の最小I/F
- v0 RBAC（guild/member/role/channel override）から AuthZ 入力への写像
- AuthZ結果種別（allow/deny/unavailable）と REST/WS 変換契約

### Out of scope
- SpiceDB クライアント実装
- Postgres 認可判定ロジック本体
- キャッシュ実装詳細

## 2. Authorizer boundary

`LIN-602` では、以下の境界を Rust trait と型で固定する。

```rust
#[async_trait]
pub trait Authorizer: Send + Sync {
    async fn check(&self, input: &AuthzCheckInput) -> Result<AuthzDecision, AuthzError>;
}

pub struct AuthzCheckInput {
    pub principal: AuthzPrincipal,
    pub resource: AuthzResource,
    pub action: AuthzAction,
}

pub struct AuthzPrincipal {
    pub principal_id: i64,
}

pub enum AuthzResource {
    Session,
    Guild { guild_id: i64 },
    GuildChannel { guild_id: i64, channel_id: i64 },
}

pub enum AuthzAction {
    Connect,
    View,
    Post,
    Manage,
}

pub enum AuthzDecision {
    Allow,
    Deny,
}

pub enum AuthzError {
    Unavailable { reason: String },
}
```

補足:
- `Deny` は決定的拒否（ポリシー上アクセス不可）。
- `Unavailable` は依存障害などで判定不能（fail-close対象）。

## 3. v0 RBAC -> AuthZ input mapping

v0 での認可関連 SoR:
- `guilds.owner_id`（owner権限のSoR）
- `guild_members`
- `guild_roles`
- `guild_member_roles`
- `channel_permission_overrides`

ロール優先度:
- `owner > admin > member`

`channel_permission_overrides` の `can_view` / `can_post` は tri-state:
- `NULL`: ロール既定値を継承
- `TRUE`: 明示許可
- `FALSE`: 明示拒否

### 3.1 Default permission baseline

ロール既定値は以下で固定する。

| role | View | Post | Manage |
| --- | --- | --- | --- |
| owner | allow | allow | allow |
| admin | allow | allow | allow |
| member | allow | allow | deny |

### 3.2 Representative mapping table

| v0 代表ケース | principal | resource | action |
| --- | --- | --- | --- |
| WS接続/再認証 | `principal_id` from AuthN | `Session` | `Connect` |
| ギルドメンバーがチャンネルを閲覧 | `principal_id` from AuthN | `GuildChannel { guild_id, channel_id }` | `View` |
| ギルドメンバーがチャンネルへ投稿 | `principal_id` from AuthN | `GuildChannel { guild_id, channel_id }` | `Post` |
| owner/admin が管理系操作を実行 | `principal_id` from AuthN | `Guild { guild_id }` または `GuildChannel` | `Manage` |

### 3.3 Deterministic rule contract

この節は実装方針ではなく、LIN-602以降で守る契約値を固定する。

- ルール0: `resource = GuildChannel` の場合、まず `channels.id == channel_id` かつ `channels.guild_id == guild_id` を検証する。
  - `View` / `Post` では `channels.type == guild_text` を必須とし、`guild_category` は deterministic deny とする。
  - `Manage` では `channels.type in ('guild_text', 'guild_category')` を許容する。
  - 同一性検証に失敗した場合は、action/roleに関係なく `Deny`。
- ルール1: `guilds.owner_id == principal_id` の場合、`View/Post/Manage` は `Allow`。
  - owner には `channel_permission_overrides` を適用しない（常時allow）。
- ルール2: owner以外で `guild_members` 未所属の場合、`View/Post/Manage` は `Deny`。
- ルール3: `Connect` は認証済み principal であれば `Allow`（WS接続/再認証の境界保護）。
- ルール4: `View`/`Post` は `guild_member_roles` で得たロール既定値に `channel_permission_overrides` を適用して決定する。
  - `guild_member_roles` は `(guild_id, user_id)` が主キーであり、1メンバー1ロール。
  - `channel_permission_overrides` は `(channel_id, level)` が主キーであり、対象ロールに対するoverrideは最大1件。
  - 判定順は「ロール既定値を計算」-> 「override値が非NULLならoverride値で上書き」-> 「最終決定」。
  - owner以外で `guild_member_roles` 行が欠落している場合は `Deny`（不整合時もfail-close）。
- ルール5: `Manage` は `admin` 以上（`admin` または `owner`）で `Allow`、それ以外は `Deny`。
- ルール6: `Manage` の `resource` は以下で固定する。
  - ギルド全体管理操作: `Guild { guild_id }`
  - 特定チャンネル管理操作: `GuildChannel { guild_id, channel_id }`
- ルール6.1: category container の create / rename / delete / child channel create は `Manage` 必須とする。
- ルール6.2: category container は message target ではない。`GuildChannel + View/Post` の対象に含めない。
- ルール7: 判定依存が失敗した場合は `Unavailable`。

## 4. Decision and transport mapping

本契約は ADR-004 に従う。

### 4.1 Deterministic deny
- REST: `403 Forbidden`
- WS: close code `1008`
- app-level code: `AUTHZ_DENIED`

### 4.2 Indeterminate (dependency unavailable)
- REST: `503 Service Unavailable`
- WS: close code `1011`
- app-level code: `AUTHZ_UNAVAILABLE`

### 4.3 Fail-close baseline
- 判定不能は許可しない。
- `stale-if-error` は禁止。

### 4.4 Temporary exception boundary

- `noop allow-all` は `LIN-602` で導入する「v1非リリース期間限定の実装例外」であり、恒久契約ではない。
- 本例外は `AUTHZ_ALLOW_ALL_UNTIL` で期限管理し、撤去条件は `LIN-629` のRunbookで固定する。
- SpiceDB移植後は本節の例外は削除対象であり、fail-close契約（4.1/4.2/4.3）を唯一の運用基準とする。
- 運用手順の詳細は `docs/runbooks/authz-noop-allow-all-spicedb-handoff-runbook.md` を参照する。

## 5. LIN-602 handoff requirements

`LIN-602` 実装がこの文書から満たすべき点:
- `Authorizer` 境界を1箇所に集約して導入する。
- REST保護ルートとWS（接続/再認証）に同じ境界を挿入する。
- `AUTHZ_PROVIDER=noop|spicedb` を導入する。
- 初期は noop allow-all を有効化し、関数内部に TODO で移植先を明記する。
- deny/unavailable のマッピングをテストで固定する。

## 6. Compatibility note

- この文書は契約固定のみを目的とし、既存AuthN契約は変更しない。
- 破壊的変更は行わない（additive only）。

## 7. LIN-632 transition note (arbitrary roles)

- LIN-632 で `guild_roles_v2` / `guild_member_roles_v2` / `channel_role_permission_overrides_v2` を導入し、任意ロールモデルへの移行基盤を追加する。
- 移行期間中、v0判定契約（本書 3.3）の読み取りSoRは維持し、dual-write/cutover/rollback は LIN-632 契約文書をSSOTとする。
- 詳細は `database/contracts/lin632_spicedb_role_model_migration_contract.md` を参照する。

## 8. LIN-633 transition note (channel user override)

- LIN-633 で `channel_user_permission_overrides_v2` を導入し、チャンネル権限上書きを role subject に加えて user subject でも表現可能にする。
- tri-state (`NULL` 継承 / `TRUE` 明示許可 / `FALSE` 明示拒否) は維持し、評価優先順は `user deny > user allow > role deny > role allow > role default > default deny` で固定する。
- 上記優先順は fail-close を前提にし、判定不能時に許可へ倒さない。
- 変換規約と移行互換方針のSSOTは `database/contracts/lin633_channel_user_override_spicedb_contract.md`。

## 9. LIN-857 transition note (legacy permission assets removal)

- LIN-857 で `guild_roles` / `guild_member_roles` / `channel_permission_overrides` / `role_level` を post-cutover で削除し、v2モデルへ単一化する。
- 本文 3章の v0写像は「移行前契約の履歴情報」として扱い、現行DB SoR は `*_v2` 系を参照する。
- 削除契約のSSOTは `database/contracts/lin857_legacy_permission_assets_removal_contract.md`。

## 10. LIN-861 API inventory and permission matrix

- 現行実装の API 棚卸しと `principal/resource/action` マトリクスのSSOTは `docs/AUTHZ_API_MATRIX.md`。
- Public（AuthZ除外）/Protected（AuthZ必須）境界は同文書に固定する。
- 後続Issue（LIN-862 以降）では同文書を入力として SpiceDB モデル・適用範囲を拡張する。

## 11. LIN-862 SpiceDB model design

- SpiceDB の namespace/relation/permission 設計SSOTは `database/contracts/lin862_spicedb_namespace_relation_permission_contract.md`。
- LIN-632/LIN-633 の tuple写像契約を受け、channel判定の優先順（`user deny > user allow > role deny > role allow > role default > default deny`）を満たす relation/permission を固定する。
- deny/unavailable の境界は ADR-004 を適用し、判定不能時の fail-open を禁止する。
- LIN-863 での local/CI 実行基盤手順は `docs/runbooks/authz-spicedb-local-ci-runtime-runbook.md` を参照する。

## 12. LIN-864 Tuple mapping and sync implementation baseline

- Postgres `*_v2` 権限データから canonical relation 名へ変換する実装SSOTは `database/contracts/lin864_postgres_spicedb_tuple_sync_contract.md`。
- 初期backfill、outbox差分同期、`authz.tuple.full_resync.v1` による最小再同期フックは同契約で固定する。
- 運用手順は `docs/runbooks/authz-spicedb-tuple-sync-operations-runbook.md` を参照する。

## 13. LIN-865 `AUTHZ_PROVIDER=spicedb` fail-close runtime baseline

- `AUTHZ_PROVIDER=spicedb` では `SpiceDB /v1/permissions/check` を使う Authorizer 実装を有効化し、`allow/deny/unavailable` を ADR-004 契約で返す。
- 判定写像（v1 baseline）は以下で固定する。
  - `Session + Connect` -> `session:global` / `can_connect`
  - `RestPath + View` -> `api_path:{path}` / `can_view`
  - 上記以外の組み合わせは deterministic deny（`403` / WS `1008`）
- SpiceDB 応答の `permissionship` は以下で解釈する。
  - `PERMISSIONSHIP_HAS_PERMISSION` -> allow
  - `PERMISSIONSHIP_NO_PERMISSION` / `PERMISSIONSHIP_CONDITIONAL_PERMISSION` / `PERMISSIONSHIP_UNSPECIFIED` -> deny
  - 不明値は unavailable（fail-close）
- 依存障害（timeout/transport/error status/初期化失敗）は unavailable（`503` / WS `1011`）へ写像し、許可へ倒さない。
- `AUTHZ_PROVIDER=spicedb` 経路で設定不正または初期化失敗が起きた場合、暗黙の `noop allow-all` フォールバックは禁止し、fail-close authorizer を使う。
- キャッシュと再試行の baseline は ADR-004 に合わせる。
  - allow TTL: `AUTHZ_CACHE_ALLOW_TTL_MS=5000`
  - deny TTL: `AUTHZ_CACHE_DENY_TTL_MS=1000`
  - retry/backoff: `SPICEDB_CHECK_MAX_RETRIES` / `SPICEDB_CHECK_RETRY_BACKOFF_MS`

## 14. LIN-867 Invite/DM/Moderation/WS apply baseline

- Invite/DM/Moderation 系 REST を `rest_auth_middleware` 保護配下に追加し、既存の `error.code/message/details/requestId` 契約を維持する。
- path->resource の追加写像（current baseline）は以下で固定する。
  - `/v1/guilds/{guild_id}/invites/{invite_code}` -> `AuthzResource::Guild { guild_id }`
  - `/v1/dms/{channel_id}` / `/v1/dms/{channel_id}/messages` -> `AuthzResource::Channel { channel_id }`
  - `/v1/moderation/guilds/{guild_id}/...` -> `AuthzResource::Guild { guild_id }`
- WS は handshake/reauth（`Session + Connect`）に加えて、接続後メッセージ処理（`/ws/stream`）でも AuthZ を評価する。
  - deny: close `1008`（`AUTHZ_DENIED`）
  - unavailable: close `1011`（`AUTHZ_UNAVAILABLE`）
- 最小観測基盤として `GET /internal/authz/metrics` を追加し、`allow_total` / `deny_total` / `unavailable_total` を公開する。

## 15. LIN-925 Permission snapshot contract baseline

- FE が v1 で必要な `can_*` 判定を 1 リクエストで取得する最小契約として、`GET /guilds/{guild_id}/permission-snapshot` を追加する。
- route 自体は `rest_auth_middleware` 配下に置き、`AuthzResource::Guild { guild_id } + View` を通過条件とする。
- 成功レスポンス shape は以下で固定する。

```json
{
  "request_id": "req_...",
  "snapshot": {
    "guild_id": 2001,
    "channel_id": 3001,
    "guild": {
      "can_view": true,
      "can_create_channel": false,
      "can_create_invite": false,
      "can_manage_settings": false,
      "can_moderate": false
    },
    "channel": {
      "can_view": true,
      "can_post": true,
      "can_manage": false
    }
  }
}
```

- `channel_id` は query parameter で受け取る。未指定時は `snapshot.channel_id = null` かつ `snapshot.channel = null`。
- v1 最小粒度は以下で固定する。
  - guild scope: `can_view`, `can_create_channel`, `can_create_invite`, `can_manage_settings`, `can_moderate`
  - channel scope: `can_view`, `can_post`, `can_manage`
- 判定写像は以下で固定する。
  - `guild.can_view`: route が `200` の場合は常に `true`
  - `guild.can_create_channel` / `guild.can_create_invite` / `guild.can_manage_settings` / `guild.can_moderate`: `AuthzResource::Guild { guild_id } + Manage`
  - `channel.can_view`: `AuthzResource::GuildChannel { guild_id, channel_id } + View`
  - `channel.can_post`: `AuthzResource::GuildChannel { guild_id, channel_id } + Post`
  - `channel.can_manage`: `AuthzResource::GuildChannel { guild_id, channel_id } + Manage`
- `Denied` は snapshot 内で boolean `false` に畳み込む。
- `DependencyUnavailable` は fail-close を維持し、endpoint 全体を `503/AUTHZ_UNAVAILABLE` で返す。部分成功や stale fallback は許可しない。
- 本 issue の範囲は contract と取得I/F の固定までであり、snapshot を使った UI ActionGuard 適用は `LIN-926` に分離する。

### 15.1 LIN-926 FE ActionGuard baseline

- FE は permission snapshot を `allowed | forbidden | unavailable | loading` の 4 状態へ正規化して扱う。
- fail-close baseline:
  - `loading`: 操作は disabled
  - `forbidden`: page は `RouteGuardScreen(kind="forbidden")`、個別操作は disabled
  - `unavailable`: page は `RouteGuardScreen(kind="service-unavailable")`、個別操作は disabled
- v1 の requirement と UI 対応は以下で固定する。
  - `guild:create-channel` -> server context menu の create channel / create-channel modal
  - `guild:manage-settings` -> server settings modal
  - `guild:moderate` -> moderation queue / moderation report detail / resolve / reopen / mute
  - `channel:manage` -> channel context menu の edit/delete / channel item settings shortcut / channel edit overview / channel delete modal
- invite 作成は real API/client が未実装のため、`LIN-926` では導線を disabled にして停止し、`CreateInviteModal` も fail-close placeholder に固定する。
