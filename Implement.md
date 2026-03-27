# Implement

## 2026-03-27 LIN-796 invite parent delta confirmation

### 必須参照
- `docs/RUST.md`
- `docs/TYPESCRIPT.md`
- `docs/DATABASE.md`
- `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md`
- `docs/adr/ADR-005-dragonfly-ratelimit-failure-policy.md`
- `.agents/skills/linear-implementation-simple-review-parent/SKILL.md`

### Start mode
- `parent issue confirmation`
- current branch: `codex/lin-796`

### Scope decisions
- `LIN-796` は親 issue として扱う。
- 既存 `main` に invite verify / join / FE 導線が入っている前提で差分だけ確認する。
- 追加要件や再現不具合が無い限り product code は変更しない。

### Evidence gathered
- Linear 上で `LIN-796` の子課題は `LIN-811` / `LIN-816` / `LIN-819` と確認した。
- 既存コード上で以下を確認した。
  - public invite verify route
  - invite join route
  - `/invite/[code]` page と invite join frontend
- `git rev-list --left-right --count origin/main...HEAD` は `0 0` だった。
- `cargo test -p linklynx_backend invite::tests:: -- --nocapture` は `28 passed, 0 failed`。

### Validation blockers
- `typescript/node_modules` が存在しないため `vitest` / `prettier` が未導入。
- そのため以下は現環境では未完了。
  - `cd typescript && npm run test -- --run ...`
  - `cd typescript && npm run typecheck`
  - `make validate`

### Actions taken
- root memory files を `LIN-796` 向けに更新した。
- 既存実装の再編集は行っていない。
