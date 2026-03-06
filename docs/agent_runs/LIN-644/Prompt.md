# LIN-644 Prompt

## Goal
- フロントで `ws-ticket -> /ws -> auth.identify -> auth.ready` を成立させる。
- `auth.reauthenticate` 受信時に Firebase 最新 ID トークンで再認証応答する。
- close code `1008/1011` の UX を契約どおり実装する。

## Non-goals
- チャット機能の拡張。
- サーバ契約変更（close code追加、WS payload仕様変更）。
- トークン永続化対応。

## Deliverables
- WS state machine（`idle/connecting/identifying/ready/closed`）実装。
- `POST /auth/ws-ticket` を使った identify ハンドシェイク実装。
- `auth.reauthenticate` 往復実装。
- `1008`: signOut + `/login?reason=session-expired` 誘導。
- `1011`: 一時障害バナー + 今すぐ再試行 + 指数バックオフ再接続。

## Done when
- [ ] `ws-ticket -> /ws -> identify -> ready` が成立する。
- [ ] `auth.reauthenticate` 応答で接続継続できる。
- [ ] `1008/1011` UX が契約どおり動作する。
- [ ] ticket/idToken を永続化・ログ出力していない。

## Constraints
- Security: ticket/idToken の平文ログ禁止、永続化禁止。
- Compatibility: `/ws?ticket=` は使わず、`/ws + auth.identify` を使う。
- Scope: LIN-644 以外の改善は混ぜない。
