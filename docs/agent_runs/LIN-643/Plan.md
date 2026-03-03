# LIN-643 Plan

## Rules
- LIN-643スコープ以外の改善は混ぜない。
- 検証失敗時は次工程に進む前に修正する。

## Milestones
### M1: WS ticket基盤追加
- Acceptance criteria:
  - [x] ticket store（ハッシュキー保存・one-time consume）を追加。
  - [x] レートリミッタとOrigin allowlistユーティリティを追加。
  - [x] 関連env契約（TTL/timeout/rate/origins）を追加。
- Validation:
  - `make rust-lint`

### M2: REST `POST /auth/ws-ticket` 実装
- Acceptance criteria:
  - [x] Bearer認証・AuthZ(connect)・rate limitを通した発行処理。
  - [x] 応答 `{ ticket, expiresAt }` を返却。
- Validation:
  - `make rust-lint`

### M3: `/ws` Identify handshake実装
- Acceptance criteria:
  - [x] 未認証接続受理 + identify timeout。
  - [x] `auth.identify` 成功で `auth.ready` を返却。
  - [x] identify前payload fail-close（1008）。
  - [x] `/ws?ticket=` と `Authorization` 互換維持。
- Validation:
  - `make rust-lint`

### M4: 再認証payload更新 + テスト整備
- Acceptance criteria:
  - [x] `auth.reauthenticate` 受信を `d.idToken` に更新。
  - [x] 既存再認証挙動（reauth_required / timeout / principal固定）維持。
  - [x] 追加API/パーサ/ユーティリティのテスト追加。
- Validation:
  - `make rust-lint`

### M5: 総合検証
- Acceptance criteria:
  - [x] Rust品質ゲート通過。
  - [ ] `make validate` 全通（TypeScript環境依存で失敗時は記録）。
- Validation:
  - `make rust-lint`
  - `make validate`
