# Documentation

## Current status
- Now: LIN-950 contract docs と SSOT 追記は完了
- Next: review evidence を固めて child PR 化する

## Decisions
- `@everyone` は UI alias とし、backend の baseline system role は `member` を維持する。
- role metadata は `name` / `priority` / `allow_view` / `allow_post` / `allow_manage` / `is_system` に限定する。
- system role (`owner/admin/member`) は v2 minimal scope では read-only とする。

## How to run / demo
- docs diff を確認し、後続 issue が参照すべき SSOT を確認する。

## Validation log
- `git diff --check`: pass
- `pnpm -C typescript install --frozen-lockfile`: pass
- `make rust-lint`: pass
- `cd typescript && npm run typecheck`: pass
- `make validate`: pass

## Environment notes
- `make validate` 実行前に Python 環境で `pip` が使えなかったため、local の `python/.venv` を bootstrap して依存関係を投入した。
- validation 用に生成された `typescript/tsconfig.tsbuildinfo` は issue diff に含めない。

## Known issues / follow-ups
- actual endpoint / DTO 実装は `LIN-951`
- request-time AuthZ 適用は `LIN-952`
- frontend 接続は `LIN-953`
- regression/runbook は `LIN-954`
