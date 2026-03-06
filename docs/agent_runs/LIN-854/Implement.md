# LIN-854 Implement Rules

- LIN-642のスコープ（汎用 `authenticatedFetch` / 保護ルート強制リダイレクト）へ拡張しない。
- DBへ直接書き込まず、既存の `/v1/protected/ping` 経由で principal 自動作成導線を利用する。
- フロント実装はFSD境界を維持する。
  - `entities/auth`: API境界・型
  - `features/auth-flow`: 画面ロジック・表示文言
- 既存Auth契約（`email_verified` 必須、fail-close）を変更しない。
- 失敗時は `request_id` を保持して運用追跡可能性を下げない。
