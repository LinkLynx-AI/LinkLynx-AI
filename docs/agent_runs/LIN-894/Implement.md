# LIN-894 Implement Rules

- `Plan.md` の順序を基本とし、順序変更時は `Documentation.md` に理由を残す。
- 既存 moderation API / route / state model を維持し、必要最小限の差分だけを入れる。
- 修正後は対象テストを先に回し、最後に `make validate` を行う。
- review gate の指摘は blocking から先に潰す。
- PR タイトル / 説明は日本語で作る。
