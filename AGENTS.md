## Working agreements (linklinx-AI)
- Child issues should follow the rule: 1 issue = 1 PR.
- Auto-merge into `main` is prohibited. PRs targeting `main` require human approval.
- PRs targeting designated branches other than `main` may be auto-merged when tests pass and review is approved.
- Do not mix out-of-scope improvements (separate refactors into different issues).
- PR title and description must be written in Japanese.

## Quality commands
- Lint: pnpm lint
- Typecheck: pnpm typecheck
- Test: pnpm test
- E2E: pnpm e2e

## Agent memory (required)
- For long-running or continuous tasks, create and maintain Prompt.md / Plan.md / Implement.md / Documentation.md.
