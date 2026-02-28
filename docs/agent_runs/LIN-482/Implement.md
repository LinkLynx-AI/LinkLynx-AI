# LIN-482 Implement Rules

- 1 issue = 1 PR の原則を維持する。
- 子Issueの実行順は LIN-496 -> LIN-501 -> LIN-502 を固定する。
- Tailwind中心の実装を維持し、複雑UIは既存 shadcn/Radix 基盤を活用する。
- FSD境界を守り、`@/shared`, `@/features`, `@/widgets` の Public API 経由 import を徹底する。
- 実処理に踏み込まず、UI/遷移レビュー可能な最小差分に限定する。
- `designs/discord-unified.pen` の色・レイアウト比率を優先し、Desktop Webを第一ターゲットとする。
