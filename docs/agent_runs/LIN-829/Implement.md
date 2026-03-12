# LIN-829 Implement

## 2026-03-10 frontend message timeline/composer real-data run

### 必須参照
- `docs/TYPESCRIPT.md`
- `docs/runbooks/realtime-nats-core-subject-subscription-runbook.md`
- `docs/runbooks/message-v1-api-ws-contract-runbook.md`
- `.agents/skills/linear-implementation-leaf/references/core-policy.md`
- `.agents/skills/linear-implementation-leaf/references/delivery-flow.md`
- `.agents/skills/linear-implementation-leaf/references/review-gates.md`

### Start mode
- `standalone smallest-unit`
- current branch: `codex/lin-829`

### Scope decisions
- guild text channel のみを対象にする
- DM route は non-goal として read/write を有効化しない
- author 表示は frontend 最小補完
- paging UI は timeline 上部ボタン方式

### Progress log
- [x] memory files 更新
- [x] message API / query / cache helper
- [x] chat UI / composer / paging
- [x] WS subscribe / realtime cache apply
- [x] review 指摘の blocking 修正
- [ ] tests / validation

### Review-driven fixes
- message REST/WS の `i64` ID は exact decimal として保持するように parser を追加
- reconnect 後は active channel の timeline query を invalidate して履歴補償する
- auth-store に `currentPrincipalId` を保持し、own-message 判定を Firebase UID 依存から分離した

## 2026-03-10 local dev startup fix

### Goal
- `make dev` で Scylla 起動直後でも message runtime が安定して立ち上がるようにする

### Changes
- `Makefile` に `scylla-wait` を追加し、CQL 応答待ちを共通化
- `scylla-bootstrap` で `.env` を読み込み、`SCYLLA_KEYSPACE` を local runtime と一致させる
- `dev` 起動時に `scylla-bootstrap` を必ず実行してから Rust API を起動する
