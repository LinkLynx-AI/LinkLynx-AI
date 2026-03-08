# LIN-928 Implement Rules

- `Plan.md` の順序を基本とし、順序変更時は `Documentation.md` に理由を残す。
- `LIN-929` に跨る UI 拡張は入れない。
- 既存レスポンス互換を優先し、破壊的変更は避ける。
- 修正後は Rust テストを先に回し、その後 TypeScript を検証する。
