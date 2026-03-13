# Documentation

## Current status
- Now: LIN-981 の実装と検証は完了。
- Next: PR へ evidence を転記する。

## Decisions
- message runbook の Draft 項目は削除せず、tracked follow-up として明文化する。
- edit/delete contract と durable event transport は current v1 delivery gate から外す。
- follow-up の owner / next target date / traceability key を repo 上へ残す。

## How to run / demo
- `make validate`
- `git diff --check`

## Known issues / follow-ups
- follow-up 項目の実装は別 issue で扱う。

## Validation log
- `make validate`
  - pass
  - Python の `m` コマンド未導入による `Error 127 (ignored)` は既存 `python/Makefile` 由来で今回差分起因ではない
- `git diff --check`
  - pass

## Review gate
- pending

## Runtime smoke
- 未実施
- skip rationale:
  - docs-only change のため live runtime smoke 対象外
