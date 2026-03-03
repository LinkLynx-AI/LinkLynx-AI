# Prompt.md (Spec / Source of truth)

## Goals
- LIN-810 の Do に従い、左カラムの `server rail / channel list` を実データへ接続する。
- `/channels/{guildId}` および `/channels/{guildId}/{channelId}` のルート遷移時に選択状態を同期させる。
- loading / error / empty の空状態表示を追加し、導線が破綻しないようにする。

## Non-goals
- UI全面改修は行わない。
- カテゴリ/スレッドの本実装は行わない（既存のUI構造を維持し、取得データ接続のみ行う）。

## Deliverables
- `shared/api` に guild/channel 実APIクライアントを追加し、既存 API singleton を差し替える。
- ルートパーサーを `shared/config/routes.ts` に追加し、server/channel 選択同期に利用する。
- `server-list` / `channel-sidebar` / `/channels/[serverId]` で loading/error/empty 表示を実装する。
- 追加実装に対する単体テストを追加する。

## Done when
- [x] server/channel 一覧が実データで表示される（`GuildChannelAPIClient` 経由）。
- [x] ルート遷移時に server/channel 選択状態が同期する。
- [x] 空状態表示が破綻しない（server rail/channel list/server page）。

## Constraints
- Perf: 不必要な再フェッチを避けるため、guild別 channel キャッシュを保持する。
- Security: Firebase ID token の Bearer 付与と、API応答の Zod 検証を境界で実施する。
- Compatibility: 既存 `Guild` / `Channel` 型と UI コンポーネント契約を維持し、欠落フィールドは安全な既定値で補完する。
