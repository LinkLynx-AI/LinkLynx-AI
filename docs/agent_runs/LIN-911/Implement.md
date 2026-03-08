# Implement.md (Runbook)

- Follow `docs/agent_runs/LIN-911/Plan.md` as the single execution order.
- Keep diffs scoped to invite verify API と public invite page のみ。
- Run validation after each milestone and fix failures before continuing.
- Record decisions, test results, and reviewer findings in `Documentation.md`.
- 修正後 review で追加対応した内容:
  - `/invite/[code]` を API gateway 固定へ変更
  - unavailable UI を invalid と分離
  - path-safe な invite verify URL join に変更
  - public invite rate limit を共有 anonymous bucket 化
  - invite status SQL で invalid を expired より優先
