# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-646` を残タスク親として実装し、実API未対応の server/channel 管理 UI を実在契約へ整列する。
- 既存 auth smoke を cross-domain smoke へ拡張し、`login -> protected route -> channel read/post -> moderation action` を自己完結で再現できるようにする。

## Non-goals
- 新規 backend API の追加。
- AutoMod、roles、emoji、stickers、boost、audit log、bans、analytics、channel permissions、integrations の本実装。
- message attachment upload、reply/pin/reaction の実接続。

## Deliverables
- server settings / channel edit UI の実API対応範囲への整列。
- invite 一覧取得エラー表示の typed helper 統一。
- `auth-e2e-smoke` の `full-discord-flow` モード追加。
- smoke 手順の runbook 更新。

## Done when
- [x] server/channel 管理 UI が実APIで成立する操作だけを露出する。
- [x] invite 一覧取得エラーが既存 API 画面と同じ契約で表示される。
- [x] `full-discord-flow` が guild/channel/message/moderation を自己完結で検証する。
- [x] 関連 test / runbook / validation evidence が更新される。

## Constraints
- Perf: 追加 smoke は既存 auth smoke の lightweight CLI を維持し、fixture 固定 ID に依存しない。
- Security: 既存 AuthZ / rate-limit / additive-only 契約を変えない。
- Compatibility: production API の public surface は変更せず、tooling CLI にのみ mode を追加する。
