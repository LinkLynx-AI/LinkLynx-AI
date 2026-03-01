# LIN-594 Plan

## Milestones
1. Linear の最新状態と依存関係を取得する。
2. GitHub PR の有無を `gh pr list` で確認する。
3. 未着手判定と次アクションを `docs/agent_runs/LIN-594/Documentation.md` に記録する。
4. LIN-594 単独変更で PR を作成する。

## Validation commands
- gh pr list --search "LIN-594 in:title" --state all --limit 20

## Acceptance checks
- Linear 状態とPR有無の両方が記録されている。
- 他Issueの変更を含まない。
