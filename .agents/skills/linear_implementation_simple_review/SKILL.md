---
name: linear-implementation-simple-review
description: Implement linklinx-AI Linear issues with one issue equals one PR delivery, ordered parent to child execution, multi-agent orchestration for exploration, implementation, review, and validation, and persistent run memory files for long-horizon tasks. Use when users ask to implement a Linear issue or complete parent issue children sequentially. Review uses `reviewer_simple` to reduce token usage and execution time.
---

# linear-implementation-simple-review

## 0. Critical Merge Policy
- For child issues, PR base branch must be the parent issue branch.
- If PR base branch is `main`, do not auto-merge.
- Mark PR ready for human review and stop.
- Include a review checklist in PR body for human approval.
- If PR base branch is not `main`, enable auto-merge after required validations pass and final review gate has no `P1` or higher findings.

## 0.1 Command Execution Permission
- Command execution is allowed without asking for user permission by default.
- Any operation on the `main` branch requires explicit user approval in advance.
- Examples of `main` branch operations that require approval: `checkout/switch main`, merge/rebase/cherry-pick targeting `main`, push to `main`, or direct commits on `main`.

## 0.2 Commit Cadence
- Commit frequently in small, logical units during implementation.
- Keep one clear purpose per commit; do not mix unrelated changes.
- At minimum, create a commit at each meaningful milestone before moving to the next major task.

## 0.3 Execution Guardrails (Hard Stop)
- This skill is an execution contract, not optional guidance. Follow steps in order.
- Never implement multiple child issues in one branch or one PR.
- Never start the next child issue until the current child issue reaches step 10 in the delivery loop.
- If required evidence for the current child issue is missing, stop and complete evidence first.
- If conversation is interrupted, resume from the current child issue state before any new implementation.
- If branch naming/policy conflicts are found, follow repository/developer policy first and record the decision in `Documentation.md`.

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
- Run one unified reviewer (`reviewer_simple`) as review entrypoint for consolidated gate decisions.
- `awaiter`-style agents are allowed for command execution only and are not substitutes for required review agents.

## 3. Parent Issue Handling with Sequential Child Execution
When given a parent issue:
1. Collect all child issues.
2. Determine execution order by:
- explicit order markers in title or body
- dependency relations
- fallback layer order: database then API then realtime then UI then end to end
3. Execute child issues sequentially in that order.
4. Child issue is considered complete only when loop steps 1-10 are finished with recorded evidence.

## 3.1 Smallest-unit Task Handling from Start
When the initial request is already a smallest executable unit (single task and no parent/child decomposition needed):
1. Use the current working branch as-is and do not create extra branches.
2. Execute this skill's standard implementation flow with the same quality gates.
3. Open one PR from the current branch to `main`.
4. Follow `main` merge policy: do not auto-merge, mark ready for human review, and stop.

## 4. Persistent Memory Files Required
Create and maintain the following files during long runs.
- `Prompt.md` for fixed goals, non-goals, done conditions
- `Plan.md` for milestones, acceptance criteria, and validation commands
- `Implement.md` for operation rules and scope boundaries
- `Documentation.md` for status, decisions, run and demo notes, and follow-ups

Use one of these locations according to repository convention.
- `docs/agent_runs/<LINEAR-IDENTIFIER>/`
- `.codex/runs/<LINEAR-IDENTIFIER>/`

## 5. Child Issue Delivery Loop
### 5.0 Explicit Required Flow (No Omission)
The following flow is mandatory per child issue and must be executed in this order.
1. Create a branch dedicated to the child issue (skip only when section 3.1 applies).
2. Run sub-agents for exploration, implementation, and validation.
3. Run review agents (`reviewer_simple`, `reviewer_ui_guard`, and `reviewer_ui` when required).
4. If review/validation gate is not passed, run sub-agents again and repeat from implementation.
5. Open PR from child-issue branch to the parent branch and merge according to policy (or to `main` when section 3.1 applies).
6. Start the next child issue only after the current child issue is merged and evidence is recorded.

For each child issue execute the same loop.
1. Create branch dedicated to this child issue (skip only when section 3.1 applies)
2. Implement scoped changes
3. Commit progress frequently in small logical units
4. Run validation commands
5. Run `reviewer_simple` for consolidated review and gate decision
6. Run `reviewer_ui_guard` to detect whether UI-related files changed
7. If UI changes are detected, run `reviewer_ui`; if not, skip UI checks
8. If self-review gate is not passed (validation failure, blocking review finding, or failed required UI checks), fix issues and return to step 2.
9. Open PR
10. Merge according to merge policy
11. Move to next issue

### 5.1 Required Per-child Evidence Before Moving On
Record all items below in `Documentation.md` per child issue. Do not proceed if any item is missing.
- child issue key and branch name
- validation commands and pass/fail results
- reviewer gate result (`reviewer_simple`) and blocking findings disposition
- UI gate result (`reviewer_ui_guard`) and `reviewer_ui` result when applicable
- PR URL, base branch, and merge/auto-merge status

### 5.2 Interruption Recovery Rule
When a run is resumed after interruption:
1. Detect the in-progress child issue from branch/commits/Documentation.
2. Complete missing loop steps for that child issue first.
3. Only then start the next child issue.

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

### Unified Reviewer
- Role key is `reviewer_simple`.
- Single-pass review covers security, correctness, performance, test quality, and coding-rule/contracts checks.
- Gate rule: block when at least one `P1` or higher finding has confidence `>= 0.65`.

### Conditional UI Review
- `reviewer_ui_guard`: decide whether current diff includes UI-impact changes.
- `reviewer_ui`: run UI checks only when guard says true.
- UI checks are skipped for non-UI diffs to keep cycle time small.

## 7. PR Convention
- Branch format: `codex/<ISSUE-KEY>-<slug>`
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
- For non-`main` base branches, enable auto-merge only after `reviewer_simple` gate pass and required validations pass.
- For `main` base branch, require human approval before merge.
- Rebase or branch from latest base before starting next issue.
- Keep at most one active child-issue PR at a time in this flow.

For smallest-unit tasks from the initial request:
- Keep working on the current branch.
- Open one PR to `main`.
- Do not enable auto-merge; require human approval.

## 8. Done Criteria
- Acceptance criteria are satisfied.
- Required validations in plan pass.
- PR is created.
- For non-main base, auto-merge is enabled after review gate pass and merge is completed automatically.
- For main base, stop at human review required state.
