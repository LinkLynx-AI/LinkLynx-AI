## Working agreements (linklinx-AI)
- 子Issueは原則 1 Issue = 1 PR。
- main への自動マージは禁止。main向けPRは人間承認が必要。
- 指定ブランチ（main以外）へのPRは、テスト成功とレビューOKなら自動マージしてよい。
- スコープ外の改善を混ぜない（refactorは別Issue）。

## Quality commands
- Lint: pnpm lint
- Typecheck: pnpm typecheck
- Test: pnpm test
- E2E: pnpm e2e

## Agent memory (required)
- 長距離または連続タスクでは Prompt.md / Plan.md / Implement.md / Documentation.md を作成して更新する。
