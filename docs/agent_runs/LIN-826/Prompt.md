# Prompt

## Goals
- WS subscribe/publish を実装し、guild text channel の購読中クライアントへ `message.created` を配信する。
- 既存 REST create / history と WS contract を接続し、後続 FE / DM issue の土台を固める。

## Non-goals
- voice / presence の追加。
- DM realtime 配信。
- broker 導入や配信保証拡張。
- 外部 API / WS frame schema の破壊的変更。

## Deliverables
- in-process の WS subscription hub。
- subscribe / unsubscribe の実購読化と disconnect cleanup。
- message create 成功時の `message.created` fanout。
- completed replay を再配信しない idempotency-aware publish 判定。

## Done when
- [ ] 2 クライアント間で subscribe 後の送受信が成立する。
- [ ] 権限外チャネル購読が fail-close で拒否される。
- [ ] completed idempotency replay で fanout が重複しない。
- [ ] `make validate` / `make rust-lint` / `cd typescript && npm run typecheck` が通る。

## Constraints
- Perf: in-process best-effort fanout に留め、同期 I/O を publish path に追加しない。
- Security: ADR-004 に従い deny は `1008/AUTHZ_DENIED`、dependency unavailable は `1011/AUTHZ_UNAVAILABLE` を維持する。
- Compatibility: LIN-821 で固定した REST / WS / event contract を変えない。
