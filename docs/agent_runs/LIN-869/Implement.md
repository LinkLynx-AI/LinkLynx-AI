- Parent branch: `codex/lin-869-patch-spicedb_review_result`
- Child execution order: LIN-873 -> LIN-883 -> LIN-875 -> LIN-874 -> LIN-882 -> LIN-881 -> LIN-876 -> LIN-884
- For each child issue:
  1. Create branch `codex/<issue-key>-<slug>` from parent branch.
  2. Implement only in-scope changes.
  3. Run required validations.
  4. Run `reviewer` gate. If P1+ findings exist, fix and repeat (max 2 re-runs).
  5. Merge child branch into parent branch.
  6. Record evidence into Documentation.md and Linear comments/status.
