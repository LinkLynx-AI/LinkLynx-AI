# LIN-646 PR draft

## Title
`LIN-646 v1 Discord 残タスクの UI 整列と full smoke を追加`

## Body
```md
## 概要
- server settings / channel edit UI を v1 の実 API 対応範囲に整列
- invite 一覧取得エラー表示を typed helper に統一
- `auth-e2e-smoke` に `full-discord-flow` を追加し、guild/channel/message/moderation の自己完結 smoke を追加
- auth smoke runbook に新モードの手順と障害切り分けを追記

## 変更理由
- v1 で未接続の設定 UI が残っており、実際に保存できない操作が見えていたため
- invite 一覧取得失敗時の表示契約が画面ごとに揺れていたため
- auth smoke だけでは Discord 系の主要フローを横断検証できていなかったため

## Acceptance Criteria 対応
- [x] server/channel 管理 UI が実APIで成立する操作だけを露出する
- [x] invite 一覧取得エラーが既存 API 画面と同じ契約で表示される
- [x] `full-discord-flow` が guild/channel/message/moderation を自己完結で検証する
- [x] 関連 test / runbook / validation evidence が更新される

## 変更詳細
- server settings は `overview` / `members` / `invites` のみ表示
- server overview は guild name update / delete のみを残し、未接続の編集 UI を削除
- channel edit modal は `overview` / `invites` のみ表示
- invite fetch error は `toApiErrorText(...)` に統一
- `auth-e2e-smoke --mode=full-discord-flow` で login -> protected ping -> ws identify -> guild/channel/message/moderation -> guild cleanup を実行
- runbook に `full-discord-flow` の前提、コマンド、成功条件、切り分けを追加

## テスト
- [x] `cd typescript && npm run test -- src/features/settings/ui/settings-layout.test.tsx src/features/settings/ui/server/server-overview.test.tsx src/features/settings/ui/server/server-invites.test.tsx src/features/modals/ui/channel-edit-invites.test.tsx src/features/modals/ui/channel-edit-modal.test.tsx scripts/auth-e2e-smoke.test.mjs`
- [x] `cd typescript && npm run typecheck`
- [x] `cd typescript && node --check scripts/auth-e2e-smoke.mjs`
- [x] `make rust-lint`
- [ ] `make validate`
  - local environment failure: `/usr/bin/python3.10: No module named pip`
- [ ] `cd typescript && npm run smoke:auth -- --mode=full-discord-flow`
  - Firebase / API 接続先が必要なため未実施

## ADR-001 checklist
- N/A
  - event schema / public runtime API の変更はなく、additive compatibility judgement の対象外

## Migration / Breaking changes
- なし
- 公開 runtime API 変更なし
- CLI 変更は `auth-e2e-smoke` の `--mode=full-discord-flow` 追加のみ

## Review / UI
- UI change: あり
- UI gate: manual self-review fallback
- reviewer: 未実施

## Linear
- LIN-646
```

## Linear comment draft
```md
実装は完了しました。

- server settings / channel edit UI を v1 の実 API 対応範囲に整列
- invite 一覧取得エラー表示を typed helper に統一
- `auth-e2e-smoke` に `full-discord-flow` を追加
- auth smoke runbook を更新

Validation:
- `cd typescript && npm run test -- src/features/settings/ui/settings-layout.test.tsx src/features/settings/ui/server/server-overview.test.tsx src/features/settings/ui/server/server-invites.test.tsx src/features/modals/ui/channel-edit-invites.test.tsx src/features/modals/ui/channel-edit-modal.test.tsx scripts/auth-e2e-smoke.test.mjs`
- `cd typescript && npm run typecheck`
- `cd typescript && node --check scripts/auth-e2e-smoke.mjs`
- `make rust-lint`

未完:
- `make validate` は local Python toolchain 不備 (`/usr/bin/python3.10: No module named pip`) で停止
- `full-discord-flow` の live smoke は Firebase / API 接続先が必要なため未実施
```
