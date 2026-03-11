# Prompt

## Goals
- `LIN-829` として guild text channel の timeline/composer を実データ送受信へ接続する。
- send/list 実 API、WS `message.subscribe` / `message.created`、履歴ページング導線を frontend で成立させる。
- 既存 UI を維持しつつ、権限/レート制限エラーでも composer 表示を崩さない。

## Non-goals
- DM 送受信の実装。
- backend 契約の拡張や UI 全面再設計。

## Deliverables
- `typescript/src/shared/api/*` の message 実接続。
- `typescript/src/app/providers/ws-auth-bridge.tsx` の channel subscribe / cache 更新。
- `typescript/src/widgets/chat/ui/*` の timeline/composer/paging/error 表示。
- 関連 unit/component test 更新。

## Done when
- [ ] guild channel で send -> receive が UI 反映まで成立する。
- [ ] WS 再接続後も active channel の購読が復元される。
- [ ] 過去メッセージ読み込み導線が動作する。
- [ ] `make validate` と `cd typescript && npm run typecheck` が通る。

## Constraints
- `LIN-829` の `Don't` に従い DM 実装を混在させない。
- TypeScript / FSD ルールに従い、UI・query・api helper を分離する。
- backend message contract は現状の `author_id` までを前提にし、frontend で最小補完する。
