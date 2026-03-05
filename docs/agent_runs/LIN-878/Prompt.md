# Prompt.md (Spec / Source of truth)

## Goals
- LIN-878 としてチャンネル編集 API（`PATCH /channels/{channel_id}`）を実装する。
- 更新対象は `name` のみに限定し、更新後に channel list と選択状態を崩さず同期する。
- 非メンバー/権限不足を fail-close で拒否し、FE で明示的なエラー表示を行う。

## Non-goals
- チャンネル削除の実装。
- カテゴリ/スレッド編集の実装。
- 権限体系の大幅な仕様変更。

## Deliverables
- Backend: `PATCH /channels/{channel_id}` のルーティング、入力検証、サービス実装。
- Backend: owner/admin（manage 権限）のみ更新可能な認可境界を追加。
- Frontend: channel edit overview を実 API 接続し、成功/失敗 UI を実装。
- Frontend: 更新後の React Query キャッシュ（`channels` / `channel`）同期。
- Tests: backend/ frontend の回帰テスト追加。

## Done when
- [x] 権限を持つユーザーがチャンネル名を更新でき、一覧に即時反映される。
- [x] 非メンバー/権限不足の更新要求が拒否される（fail-close）。
- [x] 不正入力時に API が期待どおりエラーを返し、FE で表示される。
- [x] 既存の一覧表示・ルート同期が回帰しない。

## Constraints
- Perf: 更新成功時に最小限のキャッシュ更新 + invalidate で整合を保つ。
- Security: ADR-004 fail-close 契約（`AUTHZ_DENIED` / `AUTHZ_UNAVAILABLE`）に整合させる。
- Compatibility: 既存 API 契約を壊さず additive に実装する。
