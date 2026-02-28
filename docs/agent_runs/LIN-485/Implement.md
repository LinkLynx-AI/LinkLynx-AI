# LIN-485 Implement Rules

## Scope boundaries
- UI/UX、画面遷移、モック境界のみを対象とする。
- API/DB/WS 実処理は実装しない。
- 兄弟Issue（LIN-484/LIN-487/LIN-488）の責務を侵食しない。

## UI rules
- `designs/discord-unified.pen` を見た目の一次ソースとする。
- Tailwind中心、必要箇所で既存 shadcn/Radix を活用する。
- Desktop Web 優先のレイアウトを維持する。

## Architecture rules
- FSD依存方向と Public API import を維持する。
- 既存 route/guard/state preview の挙動を壊さない。
- out-of-scope 改善は混ぜない。
