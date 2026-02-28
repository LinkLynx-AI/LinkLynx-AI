# AuthZ Contract (v1 pre-SpiceDB)

最終更新: 2026-02-28

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

- ルール0: `resource = GuildChannel` の場合、まず `channels.id == channel_id` かつ `channels.guild_id == guild_id` かつ `channels.type == guild_text` を検証する。
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
