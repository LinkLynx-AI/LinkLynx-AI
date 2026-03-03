# LIN-643 Prompt

## Goal
- WSブラウザ認証を「接続後Identify」へ移行し、`ws-ticket -> /ws -> auth.identify -> auth.ready` を実装する。
- 既存の `Authorization` ヘッダ方式は互換経路として維持する。
- WS認証導線の hardening（Origin allowlist、ログマスク、rate limit）を追加する。

## Non-goals
- AuthZ境界の変更。
- WSドメイン機能（チャット配信仕様）の追加。
- マルチノード共有ストア導入。

## Deliverables
- `POST /auth/ws-ticket` の実装（Bearer必須、短命・使い捨て）。
- `/ws` の identify handshake 実装（identify timeout、identify前payload fail-close）。
- `auth.reauthenticate` の受信payloadを `d.idToken` 形式へ更新。
- Origin allowlist / ticketハッシュ保存 / rate limit の導入。
- Rustテスト・環境変数契約の更新。

## Done when
- [x] `POST /auth/ws-ticket` が正常にチケットを返す。
- [x] `/ws` が未認証接続を受け、`auth.identify` 成功で `auth.ready` を返す。
- [x] identify前payloadと無効/再利用ticketが `1008` で拒否される。
- [x] 認証依存障害時はWSで `1011` を返す。
- [x] Origin allowlist・rate limit・ログマスクの実装が入る。

## Constraints
- Security: ticket/idToken平文をログに残さない。
- Compatibility: `Authorization` ヘッダ方式と `/ws?ticket=` を維持する。
- Runtime: 単一ノード向けメモリ管理で実装する。
