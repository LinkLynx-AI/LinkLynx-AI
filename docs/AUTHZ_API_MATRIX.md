# AuthZ API Inventory and Permission Matrix (LIN-861)

最終更新: 2026-03-08

この文書は `LIN-861` の成果物として、現行実装の API 棚卸しと
`principal/resource/action` マトリクスを固定する。

## 1. Scope and source of truth

### In scope
- `rust/apps/api/src/main/http_routes.rs` で公開される REST ルート
- `rust/apps/api/src/main/ws_routes.rs` の WS ハンドシェイク/再認証経路
- 実装済みの AuthN/AuthZ 適用境界

### Out of scope
- 各ドメインAPIの業務ロジック詳細仕様（本書はAuthZ境界と写像のみを扱う）
- SpiceDBクライアント実装詳細

## 2. Endpoint inventory

### 2.1 REST endpoints

| Method | Path | Boundary | AuthN | AuthZ | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/` | Public | なし | なし | ルート疎通 |
| GET | `/health` | Public | なし | なし | ヘルスチェック |
| GET | `/v1/invites/:invite_code` | Public | なし | なし | Public invite verify |
| POST | `/v1/invites/:invite_code/join` | AuthN-only exception | 必須 | なし | Invite join。ADR-004 の明示例外 |
| GET | `/internal/scylla/health` | Public | なし | なし | Scylla ヘルス。詳細はログに残し、レスポンスは coarse reason code のみ返す |
| GET | `/internal/auth/metrics` | Internal | internal shared secret | なし | 認証メトリクス取得。`x-linklynx-internal-shared-secret` 必須 |
| GET | `/internal/authz/metrics` | Internal | internal shared secret | なし | 認可メトリクス取得。`x-linklynx-internal-shared-secret` 必須 |
| POST | `/internal/authz/cache/invalidate` | Internal | internal shared secret | なし | AuthZ cache invalidation。bearer token だけでは到達不可 |
| GET | `/v1/protected/ping` | Protected | 必須 | 必須 | `rest_auth_middleware` を経由 |
| GET | `/v1/guilds/:guild_id` | Protected | 必須 | 必須 | Guild参照 |
| PATCH | `/v1/guilds/:guild_id` | Protected | 必須 | 必須 | Guild管理 |
| GET | `/guilds/:guild_id/channels` | Protected | 必須 | 必須 | Guild channel 一覧。category container を含みうる |
| POST | `/guilds/:guild_id/channels` | Protected | 必須 | 必須 | Guild channel / category 作成 |
| GET | `/v1/guilds/:guild_id/invites` | Protected | 必須 | 必須 | Invite一覧 |
| POST | `/v1/guilds/:guild_id/invites` | Protected | 必須 | 必須 | Invite作成 |
| DELETE | `/v1/guilds/:guild_id/invites/:invite_code` | Protected | 必須 | 必須 | Invite取消 |
| PATCH | `/channels/:channel_id` | Protected | 必須 | 必須 | Channel / category rename |
| DELETE | `/channels/:channel_id` | Protected | 必須 | 必須 | Channel / category delete |
| GET | `/v1/guilds/:guild_id/channels/:channel_id` | Protected | 必須 | 必須 | Channel参照 |
| GET | `/v1/guilds/:guild_id/channels/:channel_id/messages` | Protected | 必須 | 必須 | Message一覧参照 |
| POST | `/v1/guilds/:guild_id/channels/:channel_id/messages` | Protected | 必須 | 必須 | Message投稿 |
| GET | `/guilds/:guild_id/permission-snapshot` | Protected | 必須 | 必須 | FE 向け permission snapshot。現行は non-`v1` path を正とし、cutover 条件を満たすまで legacy surface として維持 |
| GET | `/v1/guilds/:guild_id/invites/:invite_code` | Protected | 必須 | 必須 | Invite参照 |
| GET | `/v1/dms/:channel_id` | Protected | 必須 | 必須 | DM channel参照 |
| GET | `/v1/dms/:channel_id/messages` | Protected | 必須 | 必須 | DM message一覧参照 |
| POST | `/v1/dms/:channel_id/messages` | Protected | 必須 | 必須 | DM message投稿 |
| PATCH | `/v1/moderation/guilds/:guild_id/members/:member_id` | Protected | 必須 | 必須 | Moderation操作 |

### 2.2 WebSocket endpoint

| Method | Path | Boundary | AuthN | AuthZ | Notes |
| --- | --- | --- | --- | --- | --- |
| GET (Upgrade) | `/ws` | Protected | 必須 | 必須 | ハンドシェイク時に `Session + Connect` を検査 |

## 3. Public / Protected boundary (finalized for current implementation)

### Public (AuthZ excluded)
- `GET /`
- `GET /health`
- `GET /v1/invites/:invite_code`
- `GET /internal/scylla/health`

### AuthN-only exception (AuthZ excluded)
- `POST /v1/invites/:invite_code/join`

### Internal (dedicated guard required, AuthZ excluded)
- `GET /internal/auth/metrics`
- `GET /internal/authz/metrics`
- `POST /internal/authz/cache/invalidate`
- Requirement:
  `x-linklynx-internal-shared-secret` を満たすこと。一般 bearer token や `AUTHZ_PROVIDER=noop` では通過させない
- Browser CORS:
  browser 向け permissive CORS からは切り離し、custom header preflight を公開しない

### Protected (AuthZ required)
- `GET /v1/protected/ping`
- `GET /v1/guilds/:guild_id`
- `PATCH /v1/guilds/:guild_id`
- `GET /guilds/:guild_id/channels`
- `POST /guilds/:guild_id/channels`
- `GET /v1/guilds/:guild_id/invites`
- `POST /v1/guilds/:guild_id/invites`
- `DELETE /v1/guilds/:guild_id/invites/:invite_code`
- `PATCH /channels/:channel_id`
- `DELETE /channels/:channel_id`
- `GET /v1/guilds/:guild_id/channels/:channel_id`
- `GET /v1/guilds/:guild_id/channels/:channel_id/messages`
- `POST /v1/guilds/:guild_id/channels/:channel_id/messages`
- `GET /guilds/:guild_id/permission-snapshot`
- `GET /v1/guilds/:guild_id/invites/:invite_code`
- `GET /v1/dms/:channel_id`
- `GET /v1/dms/:channel_id/messages`
- `POST /v1/dms/:channel_id/messages`
- `PATCH /v1/moderation/guilds/:guild_id/members/:member_id`
- `GET /ws`（upgrade handshake）
- `auth.reauthenticate` 処理時の再認証 AuthZ
- 再認証待機外のWSテキスト/バイナリメッセージ（`/ws/stream`）

## 4. Principal / Resource / Action matrix

## 4.1 Implemented operation matrix

| Surface | Operation | Principal | Resource | Action | Expected decision handling |
| --- | --- | --- | --- | --- | --- |
| REST | `GET /internal/auth/metrics` | 運用 caller | AuthZ対象外 | N/A | dedicated internal guard。deny=`403/INTERNAL_OPS_FORBIDDEN`, unavailable=`503/INTERNAL_OPS_UNAVAILABLE` |
| REST | `GET /internal/authz/metrics` | 運用 caller | AuthZ対象外 | N/A | dedicated internal guard。deny=`403/INTERNAL_OPS_FORBIDDEN`, unavailable=`503/INTERNAL_OPS_UNAVAILABLE` |
| REST | `POST /internal/authz/cache/invalidate` | 運用 caller | AuthZ対象外 | N/A | dedicated internal guard。general bearer token と `RestPath + can_view` には依存しない |
| REST | `GET /v1/protected/ping` | AuthN済み `principal_id` | `AuthzResource::RestPath { path: "/v1/protected/ping" }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /v1/invites/:invite_code` | なし（Public route） | AuthZ対象外 | N/A | Public verify endpoint。rate limit は invite access を適用 |
| REST | `POST /v1/invites/:invite_code/join` | AuthN済み `principal_id` | AuthZ対象外 | N/A | ADR-004 明示例外。invite state 検証と invite access rate limit を適用 |
| REST | `GET /v1/guilds/:guild_id` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `PATCH /v1/guilds/:guild_id` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `Manage` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /guilds/:guild_id/channels` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `View` | category container を含む一覧取得。deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `POST /guilds/:guild_id/channels` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `Post` | create path は handler/service で `Manage` 境界を追加適用する |
| REST | `GET /v1/guilds/:guild_id/invites` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `View` | invite list path。rate limit は `InviteAccess` を適用し、service 側で guild manage を fail-close 適用する |
| REST | `POST /v1/guilds/:guild_id/invites` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `Manage` | invite create path。route と service の両方で guild manage を fail-close 適用する |
| REST | `DELETE /v1/guilds/:guild_id/invites/:invite_code` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `Manage` | invite revoke path。rate limit は `InviteAccess` を適用し、監査ログへ `principal_id/guild_id/invite_code` を残す |
| REST | `PATCH /channels/:channel_id` | AuthN済み `principal_id` | `AuthzResource::RestPath { path: "/channels/:channel_id" }` | `Manage` | route通過後、handler/service で category を含む channel manage 判定を fail-close 適用する |
| REST | `DELETE /channels/:channel_id` | AuthN済み `principal_id` | `AuthzResource::RestPath { path: "/channels/:channel_id" }` | `Manage` | route通過後、handler/service で category cascade delete 可否を fail-close 適用する |
| REST | `GET /v1/guilds/:guild_id/channels/:channel_id` | AuthN済み `principal_id` | `AuthzResource::GuildChannel { guild_id, channel_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /v1/guilds/:guild_id/channels/:channel_id/messages` | AuthN済み `principal_id` | `AuthzResource::GuildChannel { guild_id, channel_id }` | `View` | `guild_text` のみ対象。`guild_category` は deterministic deny |
| REST | `POST /v1/guilds/:guild_id/channels/:channel_id/messages` | AuthN済み `principal_id` | `AuthzResource::GuildChannel { guild_id, channel_id }` | `Post` | `guild_text` のみ対象。`guild_category` は deterministic deny |
| REST | `GET /guilds/:guild_id/permission-snapshot` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `View` | route許可後、handler 内で `Manage` と channel `View/Post/Manage` を boolean snapshot へ写像。unavailable は `503/AUTHZ_UNAVAILABLE`。監査ログは `principal_id` / `guild_id` / `channel_id?` を残す |
| REST | `GET /v1/guilds/:guild_id/invites/:invite_code` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /v1/dms/:channel_id` | AuthN済み `principal_id` | `AuthzResource::Channel { channel_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /v1/dms/:channel_id/messages` | AuthN済み `principal_id` | `AuthzResource::Channel { channel_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `POST /v1/dms/:channel_id/messages` | AuthN済み `principal_id` | `AuthzResource::Channel { channel_id }` | `Post` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `PATCH /v1/moderation/guilds/:guild_id/members/:member_id` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `Manage` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE`。rate limit は `RestRateLimitAction::ModerationAction` を適用し、Dragonfly degraded 時は `429` fail-close |
| WS | `/ws` handshake | AuthN済み `principal_id` | `AuthzResource::Session` | `Connect` | unauthenticated upgrade 後の `auth.identify` は active ws-ticket から principal を引ける場合は principal 単位、引けない場合は session 単位で rate limit を適用する。`Origin` は allowlist 判定のみに使い、deny=`1008`, unavailable=`1011` |
| WS | `auth.reauthenticate` | AuthN済み `principal_id` | `AuthzResource::Session` | `Connect` | deny=`1008`, unavailable=`1011` |
| WS | stream text/binary message | AuthN済み `principal_id` | `AuthzResource::RestPath { path: "/ws/stream" }` | `View` | deny=`1008`, unavailable=`1011` |

### 4.2 REST action mapping rule

`rest_auth_middleware` では HTTP メソッドを次で固定変換する。

| HTTP method | AuthzAction |
| --- | --- |
| `GET` / `HEAD` | `View` |
| `POST` | `Post` |
| Other methods | `Manage` |

補足:
- `POST /v1/guilds/:guild_id/invites` は explicit path rule で `Manage` へ昇格する。

## 5. WS message inventory

### Client -> Server
- `auth.identify`（ticket付き。rate limit key は principal 優先、未解決時のみ session fallback）
- `auth.reauthenticate`（token付き）
- その他テキスト（reauth要求中は拒否、通常時はAuthZ通過後にecho）
- バイナリ（reauth要求中は拒否、通常時はAuthZ通過時のみ継続）

### Server -> Client
- `auth.ready`（identify 成功通知。`principalId` を返す）
- `auth.reauthenticate`（再認証要求）
- `auth.reauthenticated`（再認証成功通知）

## 6. Notes for downstream issues

- `LIN-925` は permission snapshot 契約と取得I/F の固定までを扱う。snapshot を使った FE ActionGuard 反映は `LIN-926` で扱う。
- `LIN-862` 以降は本マトリクスを入力に SpiceDB スキーマ・Tuple写像を設計する。
- `LIN-868` では本マトリクスの allow/deny/unavailable 回帰をCIで検知できるよう統合テストを維持する。
- `LIN-979` で moderation high-risk route の拒否/制限ログへ `reason`、`principal_id`、`guild_id`（必要に応じて `channel_id`）を残す実装へ再整合した。
- `LIN-980` 時点では permission snapshot の公開 surface は non-`v1` path のまま維持する。cutover 条件は以下:
  - backend に等価な `v1` alias を追加しても AuthN/AuthZ/監査ログ契約が変わらないこと
  - FE / client query が `v1` alias へ移行済みであること
  - 監査ダッシュボード / runbook が新旧 path の混在を不要と判断できること
