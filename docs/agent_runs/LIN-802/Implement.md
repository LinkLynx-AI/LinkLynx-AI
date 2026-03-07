# LIN-802 Implement Rules

- Rustは既存 `guild_channel/profile` と同じ fail-close 実装パターンを踏襲する。
- モデレーション対象の新規DB変更は `0016_lin822_minimal_moderation` migration に限定する。
- RESTルート追加時は `main/http_routes.rs` の既存ルーティング層へ統合する。
- TypeScriptは既存 `shared/api` と `react-query` のパターンを再利用し、深い依存を増やさない。
- キュー/詳細UIは最小導線を優先し、デザイン刷新は行わない。
