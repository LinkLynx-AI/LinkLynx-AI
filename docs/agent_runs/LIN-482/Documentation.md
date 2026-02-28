# LIN-482 Documentation

## Status
- Started: 2026-02-28
- Current: implemented (validated)

## Decisions
- 公開URL方針: 短いURL（`/login` 等）を採用し、route groupは内部構造のみに使用
- ガードUI方針: App Shell外のフルスクリーン専用画面を採用
- design準拠: `designs/discord-unified.pen` の 99 Full Screens と settings系トークンを基準に適用

## Implementation Log
- Route契約（`APP_ROUTES`）と URL builder を `shared/config/routes.ts` に追加
- `app/(public)/(auth)/(protected)` ルート構成を追加
- channels/settings 向け App Shell コンポーネントを widgets に追加
- 共通状態プレースホルダ（loading/empty/error/readonly/disabled）を追加
- route guard 機能（parse + gate + screen）を features に追加
- テスト追加: routes, shell placeholder, route guard

## Validation Log
- `npm -C typescript install --package-lock=false`: passed
- `cd typescript && npm run lint`: passed
- `cd typescript && npm run typecheck`: passed
- `cd typescript && npm run test`: passed
- `make validate`: passed
- `make rust-lint`: passed

## Follow-ups
- LIN-509/LIN-517/LIN-524 側で本UI骨格を利用して画面実装を進める
- 認証/権限の実判定ロジック実装時に preview query ベースの表示切替を差し替える
