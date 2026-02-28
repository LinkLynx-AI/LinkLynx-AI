# LIN-483 Implement Rules

## Scope boundaries
- LIN-503 は契約定義のみを対象とし、adapter実装は行わない。
- LIN-504 は mock adapter/factory と画面接続のみを対象とし、API本実装は行わない。
- 既存の route/guard/state preview 挙動は維持する。

## Repository rules
- FSD 依存方向と Public API 経由 import を守る。
- 既存UIデザイン方針（Tailwind中心、Desktop優先）を維持する。
- out-of-scope な改善は混ぜない。

## Delivery rules
- 子Issueごとに専用ブランチを作成し、順番に完了させる。
- 各子Issueで validation + reviewer gate + UI gate の証跡を Documentation に記録する。
