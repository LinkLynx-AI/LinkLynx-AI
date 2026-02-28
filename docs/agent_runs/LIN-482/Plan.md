# LIN-482 Plan

## Milestones
1. LIN-496: Route定数と route groups（public/auth/protected）
2. LIN-501: App Shell レイアウト（channels/settings）と共通状態プレースホルダ
3. LIN-502: 画面遷移ガードUI（未ログイン/権限不足/not-found）

## Validation commands
- cd typescript && npm run lint
- cd typescript && npm run typecheck
- cd typescript && npm run test
- make validate
- make rust-lint
- cd typescript && npm run typecheck

## Acceptance checks
- 公開URLが `/login`, `/register`, `/verify-email`, `/password-reset`, `/invite/[code]`, `/channels/...`, `/settings/...` で固定
- route groups の責務分離（public/auth/protected）ができている
- channels/settings の shell 骨格が再利用可能
- 5種類の共通状態プレースホルダが表示可能
- 保護ルートで guard クエリに応じたガードUIが確認可能
