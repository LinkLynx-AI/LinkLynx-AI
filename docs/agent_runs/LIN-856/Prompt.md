# LIN-856 Prompt

## Goal
- `/verify-email` 画面でメール確認完了を自動検知し、手動ボタンなしでも `/channels/me` へ自動遷移できるようにする。
- タブ復帰時（focus / visibilitychange）に即時再確認し、確認完了反映を待たせない。
- 既存の「確認状態を更新」ボタンはフォールバックとして維持する。

## Non-goals
- verify メール送信基盤の変更。
- WebPush 等の通知基盤追加。
- 認証バックエンド契約の変更。

## Deliverables
- `VerifyEmailPanel` に自動確認ロジック（5秒間隔・5分上限）を追加。
- focus / visibilitychange の即時再確認を追加。
- エラー時の通知表示と再試行継続を実装。
- タイムアウト時の手動フォールバック通知を追加。
- `verify-email-panel` の自動検知挙動をカバーする UI テストを追加。

## Done when
- [ ] 外部確認リンク完了後、手動ボタンを押さなくても一定時間内に自動遷移する。
- [ ] タブ復帰時に即時再確認が実行される。
- [ ] ネットワーク/認証エラー時に適切な通知が出て再試行される。
- [ ] 5分上限到達時に自動確認停止と手動フォールバック案内が表示される。
- [ ] 手動「確認状態を更新」ボタンが継続利用できる。

## Constraints
- Perf: 不要なリクエスト連打を避ける（in-flight ガード、5秒間隔、5分上限）。
- Security: 認証情報の保存方式や認証境界を変更しない。
- Compatibility: 既存 `reloadCurrentAuthUser` / principal provisioning 導線を維持する。

## Fixed decisions
- ポーリングは 5秒間隔、最大 5分。
- エラー時は通知を表示しつつ自動確認を継続。
- 5分到達時は自動確認を停止し、手動更新へのフォールバック通知を表示。
