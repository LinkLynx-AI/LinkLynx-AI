# LIN-623 Implement Rules

## Scope boundaries
- Touch only files needed for LIN-623 acceptance criteria.
- Prefer documentation and test-level guardrails over speculative API additions.
- Do not introduce SMTP/provider integrations in this issue.

## Change policy
- Keep diffs small and reversible.
- Preserve existing REST/WS auth contract behavior.
- If dependency assumptions from LIN-621 differ at merge time, rebase and reconcile docs/tests only.

## Quality gates
- Run Rust tests for API route behavior.
- Run repository validation (`make validate`) before review.
- Record validation outcomes in `Documentation.md`.
