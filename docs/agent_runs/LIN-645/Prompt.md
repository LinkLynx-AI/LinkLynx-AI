# Prompt.md (Spec / Source of truth)

## Goals
- `login -> protected ping -> ws identify` の最小E2Eスモークをローカルで再現可能にする。
- 正常系に加えて、依存障害時の `REST 503 / WS 1011` を運用手順で検証可能にする。
- Firebase/AuthN と SpiceDB/AuthZ の切り分け手順を runbook に反映する。

## Non-goals
- AuthN/AuthZ の契約変更。
- Playwright 導入や UI ブラウザ自動化基盤の追加。
- 無関係な runbook 拡張。

## Deliverables
- `typescript/scripts/auth-e2e-smoke.mjs`
- `typescript/package.json` の smoke command
- `typescript/.env.example` の smoke 用 env 説明
- `docs/runbooks/auth-firebase-principal-operations-runbook.md`
- `docs/runbooks/authz-spicedb-local-ci-runtime-runbook.md`

## Done when
- [ ] 正常系の smoke command が login / protected ping / ws identify を検証できる。
- [ ] 障害系の smoke command が `503 / 1011` を検証できる。
- [ ] runbook だけでローカル再現と切り分けができる。

## Constraints
- Perf: 追加スクリプトは最小依存で完結し、既存アプリコードへ影響を持ち込まない。
- Security: token / ticket を stdout やファイルへ残さない。
- Compatibility: 既存の REST/WS wire contract は変更しない。
