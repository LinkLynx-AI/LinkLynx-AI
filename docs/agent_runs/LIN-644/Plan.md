# LIN-644 Plan

## Rules
- 1 issue = 1 PR を厳守。
- 検証失敗時は次工程へ進む前に修正する。

## Milestones
### M1: Auth entity 拡張
- Acceptance criteria:
  - [x] WS接続状態型を追加。
  - [x] `issueWsTicket` API を追加。
  - [x] `signOutCurrentUser` API を追加。
- Validation:
  - `cd typescript && npm run test -- src/entities/auth/api/ws-ticket.test.ts`

### M2: WS bridge 実装
- Acceptance criteria:
  - [x] protected route かつ authenticated のときだけ接続。
  - [x] `open -> identify`、`auth.ready -> ready` 遷移。
  - [x] `auth.reauthenticate` に `getIdToken(true)` で応答。
  - [x] `1008` で signOut + login redirect。
  - [x] `1011` でバナー表示 + retry + backoff reconnect。
- Validation:
  - `cd typescript && npm run test -- src/app/providers/ws-auth-bridge.test.tsx`

### M3: Provider 組み込み + 総合検証
- Acceptance criteria:
  - [x] `Providers` に `WsAuthBridge` を組み込み。
  - [x] typecheck/test が通る。
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run test -- src/entities/auth/api/ws-ticket.test.ts src/app/providers/ws-auth-bridge.test.tsx`
