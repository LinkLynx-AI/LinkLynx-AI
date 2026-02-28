# LIN-483 Plan

## Milestones
1. LIN-503: UI Gateway interface定義（auth/guild/message/moderation）
2. LIN-504: Mock adapter + factory 実装と主要画面への接続
3. LIN-483: 親Issue向け統合PRの作成（main向け人手レビュー待ち）

## Validation commands
- cd typescript && npm run lint
- cd typescript && npm run typecheck
- cd typescript && npm run test
- make validate
- make rust-lint

## Acceptance checks
- UI境界interfaceが用途ごとに分離されている
- mock adapter構成とfactory生成ルールが定義されている
- 各UI導線で差し替え位置が明確で、API未接続でも画面確認が可能
