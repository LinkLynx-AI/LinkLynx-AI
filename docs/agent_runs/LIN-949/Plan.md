# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Record scope and inspect conflict surface
- Acceptance criteria:
  - [ ] LIN-949 run memory files exist.
  - [ ] Relevant docs are checked (`docs/RUST.md`, `docs/TYPESCRIPT.md`, `docs/DATABASE.md`, `docs/AUTHZ.md`, `ADR-004`).
  - [ ] Conflict files versus `origin/main` are identified.
- Validation:
  - `git merge-tree $(git merge-base origin/main origin/codex/lin-949) origin/main origin/codex/lin-949`

### M2: Resolve code and document conflicts minimally
- Acceptance criteria:
  - [ ] `codex/lin-949` contains all intended LIN-949 changes plus compatible `main` updates.
  - [ ] No out-of-scope files are modified.
- Validation:
  - `git status --short`
  - Targeted test/typecheck commands based on touched files

### M3: Validate repaired branch
- Acceptance criteria:
  - [ ] Targeted validations pass.
  - [ ] `make validate` is run unless scoped validation shows a blocker that must be fixed first.
- Validation:
  - `make validate`

### M4: Close out and document
- Acceptance criteria:
  - [ ] Documentation.md records decisions and validation results.
  - [ ] Final diff summary is ready for PR update.
- Validation:
  - `git diff --stat`
