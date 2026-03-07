# LIN-906 Implement

- `Plan.md` の順序で進める。
- `verify-email` は既存ロジックを維持し、破壊的変更を入れない。
- `password-reset` は列挙防止の completion message を維持したまま、再試行導線を明示する。
- 追加差分は `features/auth-flow` と `docs/agent_runs/LIN-906` に限定する。
- 検証・review・runtime smoke の結果は都度 `Documentation.md` に追記する。
