# Prompt.md (Spec / Source of truth)

## Goals
- LIN-879 としてチャンネル削除 API（`DELETE /channels/{channel_id}`）を実装する。
- Frontend の既存削除導線を実 API に接続し、右クリックメニューと編集画面の両方から削除できるようにする。
- 削除後に channel list と選択状態を崩さず同期し、現在選択中チャンネル削除時は安全な遷移へフォールバックさせる。

## Non-goals
- サーバー削除の実装。
- 一括削除や復元機能の追加。
- カテゴリ/スレッド削除や権限体系の仕様変更。
- 監査ログやイベント配信など、Issue に記載されていない副作用の追加。

## Deliverables
- Backend: `DELETE /channels/{channel_id}` ルート、入力検証、サービス実装。
- Backend: owner/admin の manage 境界による fail-close な削除認可。
- Frontend: 右クリックメニューと編集画面から開けるチャンネル削除モーダル。
- Frontend: 削除成功時の cache 同期と route フォールバック。
- Tests: backend / frontend の回帰テスト追加。

## Done when
- [ ] 権限を持つユーザーがチャンネルを削除でき、一覧から即時に消える。
- [ ] 非メンバー/権限不足ユーザーの削除要求は拒否される。
- [ ] 削除後に安全なチャンネルまたは空状態へ遷移する。
- [ ] API/FE 双方で失敗時メッセージが明示される。

## Constraints
- Perf: 成功時は対象 channel のみを局所的に cache から除外し、必要な query だけ invalidate する。
- Security: ADR-004 fail-close 契約（`AUTHZ_DENIED` / `AUTHZ_UNAVAILABLE`）に整合させる。
- Compatibility: 既存 guild/channel API 契約は additive に保ち、DB schema 変更は行わない。
