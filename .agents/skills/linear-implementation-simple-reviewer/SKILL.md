---
name: linear-implementation-simple-reviewer
description: Implement linklinx-AI Linear issues with one issue equals one PR delivery, ordered parent to child execution, and multi-agent orchestration for exploration, implementation, validation, and a simple integrated reviewer agent. Use when users ask to implement a Linear issue while reducing review-token usage by avoiding reviewer sub-agent fan-out.
---

# linear-implementation-simple-reviewer

## 0. Critical Merge Policy
- For child issues, PR base branch must be the parent issue branch.
- If PR base branch is `main`, do not auto-merge.
- Mark PR ready for human review and stop.
- Include a review checklist in PR body for human approval.
- If PR base branch is not `main`, enable auto-merge after required validations pass and final review has no `P1` or higher findings.

## 0.1 Command Execution Permission
- Command execution is allowed without asking for user permission by default.
- Any operation on the `main` branch requires explicit user approval in advance.
- Examples of `main` branch operations that require approval: `checkout/switch main`, merge/rebase/cherry-pick targeting `main`, push to `main`, or direct commits on `main`.

## 0.2 Commit Cadence
- Commit frequently in small, logical units during implementation.
- Keep one clear purpose per commit; do not mix unrelated changes.
- At minimum, create a commit at each meaningful milestone before moving to the next major task.

## 1. Linear Connection
Prefer Linear MCP for reading and updating issues.
- `codex mcp add linear --url https://mcp.linear.app/mcp`
- Or set `~/.codex/config.toml` with `mcp_servers.linear`.

If MCP is unavailable, continue implementation from provided issue content and report update text for manual sync.

Fallback procedure when MCP is unavailable:
1. Use the issue content already present in the prompt or branch context as the source of truth for the current run.
2. Keep a local sync note in `Documentation.md` with:
- target issue identifier
- implementation status
- validation results
- pending decisions/questions
3. Prepare a markdown-ready update package after each milestone so humans can paste it into Linear comments manually.
4. When MCP connectivity is restored, backfill the updates to Linear in chronological order.

## 2. Multi-agent Usage Rules
- Use separate agents for exploration, implementation, validation, and review to reduce context drift.
- Run read-heavy and check-heavy work in parallel when safe.
- Avoid parallel writes to the same code area; default to a single worker for edits.
- Use one `reviewer` agent as the only review entrypoint and keep review in a single pass.
- Do not spawn specialist reviewer sub-agents (`reviewer_security`, `reviewer_correctness`, `reviewer_performance`, `reviewer_test_quality`, `reviewer_coding_rules`).

## 3. Parent Issue Handling with Sequential Child Execution
When given a parent issue:
1. Collect all child issues.
2. Determine execution order by:
- explicit order markers in title or body
- dependency relations
- fallback layer order: database then API then realtime then UI then end to end
3. Execute child issues sequentially in that order.

## 4. Persistent Memory Files Required
Create and maintain the following files during long runs.
- `Prompt.md` for fixed goals, non-goals, done conditions
- `Plan.md` for milestones, acceptance criteria, and validation commands
- `Implement.md` for operation rules and scope boundaries
- `Documentation.md` for status, decisions, run and demo notes, and follow-ups

Use one of these locations according to repository convention.
- `docs/agent_runs/<LINEAR-IDENTIFIER>/`
- `.codex/runs/<LINEAR-IDENTIFIER>/`

Memory template files are available under `assets/memory_templates/`.

## 5. Child Issue Delivery Loop
For each child issue execute the same loop.
1. Create branch
2. Implement scoped changes
3. Commit progress frequently in small logical units
4. Run validation commands
5. Run one simple `reviewer` pass following `references/agents/simple-reviewer.md`
6. Run `reviewer_ui_guard` to detect whether UI-related files changed
7. If UI changes are detected, run `reviewer_ui`; if not, skip UI checks
8. If self-review gate is not passed (validation failure, blocking review finding, or failed required UI checks), fix issues and return to step 2.
9. Open PR
10. Merge according to merge policy
11. Move to next issue

## 6. Role Contracts
### Explorer
- Identify relevant files, existing patterns, dependency and risk areas.
- Return concise actionable summary.

### Worker
- Implement only the current milestone in plan.
- Keep diff minimal and avoid scope expansion.

### Monitor or Tester
- Run lint, typecheck, test, build, and issue-specific checks.
- Summarize failures with likely causes.

### Simple Reviewer
- Role key is `reviewer`.
- Review in one pass across security, correctness, performance, test quality, and coding-rules compliance.
- Do not delegate review to other reviewer sub-agents.
- Produce one consolidated finding list with deduplication and normalized severity.
- Gate rule: block when at least one `P1` or higher finding has confidence `>= 0.65`.

### Conditional UI Review
- `reviewer_ui_guard`: decide whether current diff includes UI-impact changes.
- `reviewer_ui`: run UI checks only when guard says true.
- UI checks are skipped for non-UI diffs to keep cycle time small.

## 7. PR Convention
- Branch format: `linear/<ISSUE-KEY>-<slug>`
- PR body includes:
- what and why
- acceptance criteria mapping
- how to test with results
- migration or breaking changes if any
- link to Linear issue
- review outcome:
- blocking findings (`P1+`) and required fixes
- non-blocking suggestions (`P2/P3`)
- UI check result:
- `skipped` with rationale when no UI changes
- `passed/failed` with executed checks and evidence when UI checks run

For sequential issue runs:
- Open and merge one PR per issue.
- For child issues, open PRs with the parent issue branch as the base branch.
- For non-`main` base branches, enable auto-merge only after simple reviewer approval and required validations pass.
- For `main` base branch, require human approval before merge.
- Rebase or branch from latest base before starting next issue.

## 8. Done Criteria
- Acceptance criteria are satisfied.
- Required validations in plan pass.
- PR is created.
- For non-main base, auto-merge is enabled after review gate pass and merge is completed automatically.
- For main base, stop at human review required state.
