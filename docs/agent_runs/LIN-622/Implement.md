# LIN-622 Implement Rules

- scope は LIN-622 に限定し、横断リファクタは行わない。
- 認証ミドルウェアは I/O のみを維持し、生成責務は `auth/principal.rs` の専用境界で完結する。
- fail-close を崩さない（不明確な状態は allow しない）。
- 競合時は email 自動紐付けを行わず、再解決または明示拒否で収束する。
- legacy schema と SoR 移行中の互換性を壊さない（`users` insert は段階互換）。
