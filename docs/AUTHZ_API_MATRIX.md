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
| GET | `/internal/auth/metrics` | Public | なし | なし | 認証メトリクス取得 |
| GET | `/internal/authz/metrics` | Public | なし | なし | 認可メトリクス取得 |
| GET | `/v1/protected/ping` | Protected | 必須 | 必須 | `rest_auth_middleware` を経由 |
| GET | `/v1/guilds/:guild_id` | Protected | 必須 | 必須 | Guild参照 |
| PATCH | `/v1/guilds/:guild_id` | Protected | 必須 | 必須 | Guild管理 |
| GET | `/guilds/:guild_id/channels` | Protected | 必須 | 必須 | Guild channel 一覧。category container を含みうる |
| POST | `/guilds/:guild_id/channels` | Protected | 必須 | 必須 | Guild channel / category 作成 |
| POST | `/v1/guilds/:guild_id/invites` | Protected | 必須 | 必須 | Invite作成 |
| PATCH | `/channels/:channel_id` | Protected | 必須 | 必須 | Channel / category rename |
| DELETE | `/channels/:channel_id` | Protected | 必須 | 必須 | Channel / category delete |
| GET | `/v1/guilds/:guild_id/channels/:channel_id` | Protected | 必須 | 必須 | Channel参照 |
| GET | `/v1/guilds/:guild_id/channels/:channel_id/messages` | Protected | 必須 | 必須 | Message一覧参照 |
| POST | `/v1/guilds/:guild_id/channels/:channel_id/messages` | Protected | 必須 | 必須 | Message投稿 |
| GET | `/guilds/:guild_id/permission-snapshot` | Protected | 必須 | 必須 | FE 向け permission snapshot |
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
- `GET /internal/auth/metrics`
- `GET /internal/authz/metrics`

### AuthN-only exception (AuthZ excluded)
- `POST /v1/invites/:invite_code/join`

### Protected (AuthZ required)
- `GET /v1/protected/ping`
- `GET /v1/guilds/:guild_id`
- `PATCH /v1/guilds/:guild_id`
- `GET /guilds/:guild_id/channels`
- `POST /guilds/:guild_id/channels`
- `POST /v1/guilds/:guild_id/invites`
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
| REST | `GET /v1/protected/ping` | AuthN済み `principal_id` | `AuthzResource::RestPath { path: "/v1/protected/ping" }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /v1/invites/:invite_code` | なし（Public route） | AuthZ対象外 | N/A | Public verify endpoint。rate limit は invite access を適用 |
| REST | `POST /v1/invites/:invite_code/join` | AuthN済み `principal_id` | AuthZ対象外 | N/A | ADR-004 明示例外。invite state 検証と invite access rate limit を適用 |
| REST | `GET /v1/guilds/:guild_id` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `PATCH /v1/guilds/:guild_id` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `Manage` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /guilds/:guild_id/channels` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `View` | category container を含む一覧取得。deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `POST /guilds/:guild_id/channels` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `Post` | create path は handler/service で `Manage` 境界を追加適用する |
| REST | `POST /v1/guilds/:guild_id/invites` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `Manage` | invite create path。route と service の両方で guild manage を fail-close 適用する |
| REST | `PATCH /channels/:channel_id` | AuthN済み `principal_id` | `AuthzResource::RestPath { path: "/channels/:channel_id" }` | `Manage` | route通過後、handler/service で category を含む channel manage 判定を fail-close 適用する |
| REST | `DELETE /channels/:channel_id` | AuthN済み `principal_id` | `AuthzResource::RestPath { path: "/channels/:channel_id" }` | `Manage` | route通過後、handler/service で category cascade delete 可否を fail-close 適用する |
| REST | `GET /v1/guilds/:guild_id/channels/:channel_id` | AuthN済み `principal_id` | `AuthzResource::GuildChannel { guild_id, channel_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /v1/guilds/:guild_id/channels/:channel_id/messages` | AuthN済み `principal_id` | `AuthzResource::GuildChannel { guild_id, channel_id }` | `View` | `guild_text` のみ対象。`guild_category` は deterministic deny |
| REST | `POST /v1/guilds/:guild_id/channels/:channel_id/messages` | AuthN済み `principal_id` | `AuthzResource::GuildChannel { guild_id, channel_id }` | `Post` | `guild_text` のみ対象。`guild_category` は deterministic deny |
| REST | `GET /guilds/:guild_id/permission-snapshot` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `View` | route許可後、handler 内で `Manage` と channel `View/Post/Manage` を boolean snapshot へ写像。unavailable は `503/AUTHZ_UNAVAILABLE` |
| REST | `GET /v1/guilds/:guild_id/invites/:invite_code` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /v1/dms/:channel_id` | AuthN済み `principal_id` | `AuthzResource::Channel { channel_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `GET /v1/dms/:channel_id/messages` | AuthN済み `principal_id` | `AuthzResource::Channel { channel_id }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `POST /v1/dms/:channel_id/messages` | AuthN済み `principal_id` | `AuthzResource::Channel { channel_id }` | `Post` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| REST | `PATCH /v1/moderation/guilds/:guild_id/members/:member_id` | AuthN済み `principal_id` | `AuthzResource::Guild { guild_id }` | `Manage` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE`。rate limit は `RestRateLimitAction::ModerationAction` を適用し、Dragonfly degraded 時は `429` fail-close |
| WS | `/ws` handshake | AuthN済み `principal_id` | `AuthzResource::Session` | `Connect` | deny=`1008`, unavailable=`1011` |
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
- `auth.reauthenticate`（token付き）
- その他テキスト（reauth要求中は拒否、通常時はAuthZ通過後にecho）
- バイナリ（reauth要求中は拒否、通常時はAuthZ通過時のみ継続）

### Server -> Client
- `auth.reauthenticate`（再認証要求）
- `auth.reauthenticated`（再認証成功通知）

## 6. Notes for downstream issues

- `LIN-925` は permission snapshot 契約と取得I/F の固定までを扱う。snapshot を使った FE ActionGuard 反映は `LIN-926` で扱う。
- `LIN-862` 以降は本マトリクスを入力に SpiceDB スキーマ・Tuple写像を設計する。
- `LIN-868` では本マトリクスの allow/deny/unavailable 回帰をCIで検知できるよう統合テストを維持する。
- `LIN-979` で moderation high-risk route の拒否/制限ログへ `reason`、`principal_id`、`guild_id`（必要に応じて `channel_id`）を残す実装へ再整合した。
