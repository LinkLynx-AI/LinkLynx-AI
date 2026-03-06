# Prompt.md (Spec / Source of truth)

## Goals
- LIN-859 の Do に従い、サーバー作成（`POST /guilds`）を FE から実 API へ接続する。
- LIN-859 の Do に従い、チャンネル作成（`POST /guilds/{guild_id}/channels`）を FE から実 API へ接続する。
- 作成成功後に一覧反映と選択/遷移同期を保証する。
- 作成失敗（validation/authz/unavailable）で画面を破綻させず、モーダル内にエラー表示する。

## Non-goals
- UI 全面改修は行わない。
- カテゴリ/スレッド作成の本実装は行わない。
- 権限モデルや backend 仕様の追加変更は行わない。

## Deliverables
- `GuildChannelAPIClient` に `createServer` / `createChannel` を実装し、レスポンスを既存 `Guild` / `Channel` 型へマップする。
- create 成功時のルート遷移を実装する（server 作成後 `/channels/{guildId}`、channel 作成後 `/channels/{guildId}/{channelId}`）。
- create 失敗時のエラーメッセージ変換を実装する（`toCreateActionErrorText`）。
- channel 作成導線を server context menu に最小追加する。
- v1 制約として channel 作成種別はテキストのみ有効化する。
- 追加仕様を担保するテストを追加する。

## Done when
- [x] サーバー作成が実 API で成功し、server rail へ反映される。
- [x] チャンネル作成が実 API で成功し、channel list へ反映される。
- [x] 作成直後の選択状態/ルート遷移が同期する。
- [x] エラー時に適切なメッセージが表示され、一覧表示が破綻しない。

## Constraints
- Perf: 作成成功時に React Query キャッシュを更新して反映遅延を抑えつつ、最終的に invalidate で整合させる。
- Security: 既存の `authenticatedRequest`（Bearer ID token 付与）を利用し、失敗時は `request_id` を保持する。
- Compatibility: `APIClient` の公開シグネチャは変更しない。既存 UI 構造を維持し、最小差分で導線を追加する。
