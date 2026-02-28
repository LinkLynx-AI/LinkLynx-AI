# LIN-485 Plan

## Milestones
1. LIN-517: 左カラムUI（server rail + channel/dm list）
2. LIN-518: 会話UI（channel/dm timeline + composer）
3. LIN-516: 招待導線UI（/invite/[code] + 認証後復帰導線）
4. LIN-523: メッセージ状態UI（pending/failed/retry/jump/edit/delete）

## Validation commands
- cd typescript && npm run lint
- cd typescript && npm run typecheck
- cd typescript && npm run test
- make validate
- make rust-lint

## Acceptance checks
- 左カラムで選択/未読/ホバー/ミュートの見た目が再利用可能。
- channel/dm で timeline + composer が整合して表示される。
- /invite/[code] で valid/invalid/expired と復帰導線が表示される。
- 会話UIで pending/failed/retry/jump/edit/delete が判別できる。
- 主要導線が機能未実装のままレビュー可能。
