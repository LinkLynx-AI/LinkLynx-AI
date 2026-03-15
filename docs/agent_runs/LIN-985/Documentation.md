# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-985` の実装・docs 更新・validation を完了し、review gate と PR 作成へ進める状態。
- Next: reviewer 結果を確認し、commit / push / PR / Linear 同期を行う。

## Decisions
- public invite verify の key は、trusted proxy shared secret が一致したときの explicit client scope header を優先し、それ以外は shared anonymous fallback を使う方針で進める。
- spoof 耐性のため `X-Forwarded-For` は rate-limit key の source of truth に使わない。
- invite join は principal 単位 rate-limit を維持しつつ、audit log には同じ client scope を残す。
- trusted proxy 契約は固定 header `x-linklynx-trusted-proxy-secret` + `x-linklynx-client-scope` で表現し、runtime secret は `PUBLIC_INVITE_TRUSTED_PROXY_SHARED_SECRET` で受ける。
- invalid / missing secret、空文字 secret、無効 client scope 値では `public:anonymous:invite_access` fallback を使い、ADR-005 の fail-close はそのまま維持する。

## How to run / demo
- targeted tests:
  - `cd rust && cargo test -p linklynx_backend public_invite_endpoint_ -- --nocapture`
  - `cd rust && cargo test -p linklynx_backend invite_join_ -- --nocapture`
- strict gate:
  - `make rust-lint`
  - `git diff --check`
- runtime smoke:
  - `cd rust && FIREBASE_PROJECT_ID=test-project DATABASE_URL=postgres://postgres:password@localhost:5432/linklynx AUTH_ALLOW_POSTGRES_NOTLS=true PUBLIC_INVITE_TRUSTED_PROXY_SHARED_SECRET=smoke-secret cargo run -p linklynx_backend`
  - `curl -i http://127.0.0.1:8080/health` -> `200 OK`
  - `curl -i -H 'x-linklynx-trusted-proxy-secret: smoke-secret' -H 'x-linklynx-client-scope: smoke-client-a' http://127.0.0.1:8080/v1/invites/UNKNOWN2026` -> `200` with `status=invalid`

## Validation log
- pass: `cd rust && cargo test -p linklynx_backend public_invite_endpoint_ -- --nocapture`
- pass: `cd rust && cargo test -p linklynx_backend invite_join_ -- --nocapture`
- pass: `make rust-lint`
- pass: `git diff --check`
- pass: runtime smoke (`/health`, `/v1/invites/UNKNOWN2026` with trusted scope headers)
- fail: `make validate` (`typescript/node_modules` 不在で `prettier` が見つからない)
- fail: `cd typescript && npm run typecheck` (`typescript/node_modules` 不在で `tsc` が見つからない)

## Known issues / follow-ups
- edge 側で client scope header を付与する runtime/runbook 整備が別途必要な可能性がある。
