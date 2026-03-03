---
name: linear-implementation-simple-review
description: Route linklinx-AI implementation requests to simple-review specialized execution skills. Use when the request references the legacy `linear-implementation-simple-review` skill and issue type must be dispatched to either parent-issue execution or leaf-issue execution with `reviewer_simple` gates.
---

# linear-implementation-simple-review

## Goal
- Keep backward compatibility for the legacy simple-review skill name.
- Route to the correct specialized skill and then follow that skill only.

## Issue-type Decision Procedure
1. Prefer Linear MCP issue metadata when available.
- Parent issue: issue has one or more child issues.
- Leaf issue: issue has no children and is either a child issue itself or a standalone smallest-unit issue.
2. If Linear MCP metadata is unavailable, infer from request text.
- Parent issue signals: explicit child list, ordered execution list, or request to run parent-to-child flow.
- Leaf issue signals: single issue key scope, explicit child issue start, or standalone single-task request.
3. If signals are insufficient or conflicting, ask exactly one clarifying question.
- "Is this a parent issue with child issues, or a single leaf issue run?"

## Routing Rules
1. Route parent issue input to `$linear-implementation-simple-review-parent`.
2. Route leaf issue input to `$linear-implementation-simple-review-leaf`.

## Handoff Contract
- After routing, stop using this router and follow the target skill contracts.
- Load references from the target skill, not from this file.
- Preserve one issue equals one PR and existing merge policy behavior.

## Non-goals
- Do not execute full delivery flow directly in this router.
- Do not mix parent and leaf flows in one run.
