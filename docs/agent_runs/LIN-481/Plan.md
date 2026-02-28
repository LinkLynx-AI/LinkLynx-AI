# LIN-481 Plan

## Milestones
1. LIN-490: FSDスライス雛形とPublic API index整備
2. LIN-492: Tailwind v4トークンとLight/Dark変数定義
3. LIN-495: shadcn/ui + Radix Core導入（公式CLI準拠）

## Validation commands
- make validate
- make rust-lint
- cd typescript && npm run typecheck

## Acceptance checks
- FSD依存方向に沿ったレイヤ構成が存在する
- deep import前提を避けるPublic APIが整備される
- Tailwindトークンとlight/dark変数が利用可能
- Core部品が共有UIとして再利用可能
