# Prompt.md (Spec / Source of truth)

## Goals
- LIN-880 の Do に従い、サーバー削除 API とフロント削除導線を実装する。
- owner または管理権限者だけが削除できる fail-close 契約を維持する。
- 削除後に server rail / 現在表示中ルートを安全な遷移先へ整合させる。

## Non-goals
- 論理削除や復元機能は追加しない。
- チャンネル削除仕様や招待/DM/メッセージ仕様は広げない。
- 既存のサーバー脱退導線は変更しない。

## Deliverables
- `DELETE /guilds/{guild_id}` の backend 実装とテスト。
- server settings の danger zone と確認ダイアログの frontend 実装。
- 削除後の cache cleanup と fallback routing。
- 実装ログと validation / review / smoke の証跡。

## Done when
- [ ] 権限ありユーザーがサーバーを削除できる。
- [ ] 権限なしユーザーは fail-close で拒否される。
- [ ] 削除後に server rail と表示中ルートが破綻しない。
- [ ] 確認 UI があり、誤操作抑止が機能する。

## Constraints
- Perf: server rail と channel list の整合は即時 cache 更新で維持する。
- Security: ADR-004 に従い、AuthZ は deny / unavailable を区別しつつ fail-close とする。
- Compatibility: 既存 `GuildChannelService` / React Query key / settings UI パターンを壊さない。
