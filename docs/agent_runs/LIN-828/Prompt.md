# Prompt

## Goals
- guild channel message edit/delete の WS fanout を追加する。
- WS 反映後の message snapshot が履歴 list と同じ `MessageItemV1` に揃うようにする。
- frontend query cache でも `message.updated` / `message.deleted` を同じ snapshot で反映できるようにする。

## Non-goals
- FE の inline edit/delete UI 実装は行わない。
- durable event transport の実処理は追加しない。

## Deliverables
- `message.updated` / `message.deleted` の WS contract 追加
- backend realtime hub から edit/delete 成功時の fanout 実装
- frontend websocket bridge の cache 更新と stale version guard
- 既存 test / runbook 更新

## Done when
- [ ] edit/delete 成功時に購読中 WS へ対応 frame が送られる
- [ ] frame payload が `MessageItemV1` の最新 snapshot を保持する
- [ ] frontend cache が update/delete tombstone を取り込み、古い version で巻き戻らない
- [ ] 既存 list API と整合することを test / evidence で示せる

## Constraints
- Perf: 既存 realtime hub の best-effort fanout 方針を維持する
- Security: AuthZ は ADR-004 fail-close を維持する
- Compatibility: ADR-001 に従い additive change のみで進める
