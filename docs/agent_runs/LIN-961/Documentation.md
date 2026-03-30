# Documentation.md (Status / audit log)

## Current status
- Now: ADR / infra summary / edge runbook の更新は完了し、PR 化前の整理に入っている。
- Next: commit / push / PR 作成後に LIN-963 へ進む。

## Decisions
- 既存 local branch `codex/lin-961-edge-strategy-adr` は stale のため再利用しない。
- 親 issue の strict order を優先し、LIN-963 より先に LIN-961 を main へ出す。
- Phase 1 edge baseline は `Cloud DNS / Certificate Manager / GCLB / Cloud Armor / optional Cloud CDN` とする。
- API / WebSocket は CDN cache 対象外とする。

## How to run / demo
- `make validate`
- `git diff --check`
- Result: `make validate` pass, `git diff --check` pass

## Known issues / follow-ups
- `docs/infra/00_discussion.md` は議論ログとして Cloudflare 案を含むが、SSOT は ADR-006 と `docs/infra/01_decisions.md` に移る。
- runtime smoke は docs-only issue のため不要。
