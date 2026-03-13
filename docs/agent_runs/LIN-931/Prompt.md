# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-931` として WebSocket 接続時の認証ガードを runbook に沿って固定する。
- invalid / expired / unavailable な認証状態を WS close code で fail-close する。

## Non-goals
- WebSocket プロトコル全体の再設計。
- session resume の追加仕様。

## Deliverables
- backend WS handshake / identify 認証ガード修正
- Rust contract tests
- run record

## Done when
- [ ] Authorization header / query ticket / identify の失敗が runbook どおり close code `1008/1011` へ写像される
- [ ] 認証済み導線と矛盾しない

## Constraints
- Perf: 既存 handshake の hot path を崩さない
- Security: fail-close を維持する
- Compatibility: `GET /ws` と `auth.identify` 契約を変えない
