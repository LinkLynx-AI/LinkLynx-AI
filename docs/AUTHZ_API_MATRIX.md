# AuthZ API Inventory and Permission Matrix (LIN-861)

最終更新: 2026-03-04

この文書は `LIN-861` の成果物として、現行実装の API 棚卸しと
`principal/resource/action` マトリクスを固定する。

## 1. Scope and source of truth

### In scope
- `rust/apps/api/src/main/http_routes.rs` で公開される REST ルート
- `rust/apps/api/src/main/ws_routes.rs` の WS ハンドシェイク/再認証経路
- 実装済みの AuthN/AuthZ 適用境界

### Out of scope
- 未実装ドメインAPI（Guild/Channel/Message/Invite/DM/Moderation本体）の将来仕様
- SpiceDBクライアント実装詳細

## 2. Endpoint inventory

### 2.1 REST endpoints

| Method | Path | Boundary | AuthN | AuthZ | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/` | Public | なし | なし | ルート疎通 |
| GET | `/health` | Public | なし | なし | ヘルスチェック |
| GET | `/internal/auth/metrics` | Public | なし | なし | 認証メトリクス取得 |
| GET | `/v1/protected/ping` | Protected | 必須 | 必須 | `rest_auth_middleware` を経由 |

### 2.2 WebSocket endpoint

| Method | Path | Boundary | AuthN | AuthZ | Notes |
| --- | --- | --- | --- | --- | --- |
| GET (Upgrade) | `/ws` | Protected | 必須 | 必須 | ハンドシェイク時に `Session + Connect` を検査 |

## 3. Public / Protected boundary (finalized for current implementation)

### Public (AuthZ excluded)
- `GET /`
- `GET /health`
- `GET /internal/auth/metrics`

### Protected (AuthZ required)
- `GET /v1/protected/ping`
- `GET /ws`（upgrade handshake）
- `auth.reauthenticate` 処理時の再認証 AuthZ

## 4. Principal / Resource / Action matrix

## 4.1 Implemented operation matrix

| Surface | Operation | Principal | Resource | Action | Expected decision handling |
| --- | --- | --- | --- | --- | --- |
| REST | `GET /v1/protected/ping` | AuthN済み `principal_id` | `AuthzResource::RestPath { path: "/v1/protected/ping" }` | `View` | deny=`403/AUTHZ_DENIED`, unavailable=`503/AUTHZ_UNAVAILABLE` |
| WS | `/ws` handshake | AuthN済み `principal_id` | `AuthzResource::Session` | `Connect` | deny=`1008`, unavailable=`1011` |
| WS | `auth.reauthenticate` | AuthN済み `principal_id` | `AuthzResource::Session` | `Connect` | deny=`1008`, unavailable=`1011` |

### 4.2 REST action mapping rule

`rest_auth_middleware` では HTTP メソッドを次で固定変換する。

| HTTP method | AuthzAction |
| --- | --- |
| `GET` / `HEAD` | `View` |
| `POST` | `Post` |
| Other methods | `Manage` |

## 5. WS message inventory

### Client -> Server
- `auth.reauthenticate`（token付き）
- その他テキスト（reauth要求中は拒否、通常時はecho）

### Server -> Client
- `auth.reauthenticate`（再認証要求）
- `auth.reauthenticated`（再認証成功通知）

## 6. Notes for downstream issues

- `LIN-862` 以降は本マトリクスを入力に SpiceDB スキーマ・Tuple写像を設計する。
- `LIN-866` / `LIN-867` で新規ドメインAPIを適用する際は、本ファイルに endpoint を追加する。
