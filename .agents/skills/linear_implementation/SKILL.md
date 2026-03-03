---
name: linear-implementation
description: Route linklinx-AI implementation requests to specialized execution skills. Use when the request references the legacy `linear-implementation` skill and issue type must be dispatched to either parent-issue execution or leaf-issue execution while keeping backward compatibility.
---

# linear-implementation

## Goal
- Keep backward compatibility for the legacy skill name.
- Route to the correct specialized skill and then follow that skill only.

## Routing Rules
1. If input is a parent issue with child issues, route to `$linear-implementation-parent`.
2. If input is a child issue start or standalone smallest-unit issue start, route to `$linear-implementation-leaf`.
3. If issue type is ambiguous, ask exactly one clarifying question:
- "Is this a parent issue with child issues, or a single leaf issue run?"

## Handoff Contract
- After routing, stop using this router and follow the target skill contracts.
- Load references from the target skill, not from this file.
- Preserve one issue equals one PR and existing merge policy behavior.

## Non-goals
- Do not execute full delivery flow directly in this router.
- Do not mix parent and leaf flows in one run.
