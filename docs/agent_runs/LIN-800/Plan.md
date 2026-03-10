# Plan

## Rules
- Stop-and-fix: validation または review で失敗したら次の child へ進まない。
- Scope lock: `LIN-800` 配下の `LIN-824` / `LIN-827` / `LIN-830` のみを扱う。
- Start mode: `parent issue start`
- Parent branch: `codex/lin800`

## Milestones
### M1: run memory と LIN-824 backend を実装する
- Acceptance criteria:
  - [ ] `docs/agent_runs/LIN-800/` の 4 ファイルを作成
  - [ ] DM open-or-create / list / detail API を追加
  - [ ] 同一ペア冪等性を固定
- Validation:
  - `cd rust && cargo test -p linklynx_backend dm_`

### M2: LIN-827 DM 履歴 / 投稿を live 接続する
- Acceptance criteria:
  - [ ] DM 履歴取得が live storage へ接続される
  - [ ] DM 投稿が live storage へ接続される
  - [ ] participant 境界を service / route test で固定
- Validation:
  - `cd rust && cargo test -p linklynx_backend dm_message_`

### M3: LIN-830 frontend を実データへ接続する
- Acceptance criteria:
  - [ ] DM 一覧 / 会話遷移 / composer が live API を使う
  - [ ] 既存 DM の再訪が成立する
  - [ ] 主要導線の regression test を追加
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm test -- --runInBand guild-channel-api-client`

### M4: 全体検証と review gate を通す
- Acceptance criteria:
  - [ ] `make rust-lint` が通る
  - [ ] `make validate` が通る
  - [ ] reviewer gate の blocking 指摘がない
- Validation:
  - `make rust-lint`
  - `make validate`
