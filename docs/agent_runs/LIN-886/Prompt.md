# Prompt.md (Spec / Source of truth)

## Goals
- 設定画面で変更した avatar / banner を保存し、保存成功後に即時反映する。
- 再読み込み / 再ログイン後も保存済みプロフィール画像が反映されるようにする。
- 保存失敗時にエラー表示と再試行導線を維持する。

## Non-goals
- 画像トリミングUIの大規模刷新。
- 新しいアップロード基盤の導入。
- 無関係なプロフィール項目やテーマ機能の追加。
- profile modal / popout への横展開。

## Deliverables
- `banner_key` を含む profile API / DB 契約拡張。
- Firebase Storage を用いた avatar / banner 保存フロー。
- auth-store / settings UI / user panel の同期改善。
- 関連テストと検証結果。

## Done when
- [x] avatar 変更を保存すると設定画面プレビューとユーザーパネルへ反映される。
- [x] banner 変更を保存すると設定画面プレビューへ反映される。
- [x] 画面再読み込み後も保存済み avatar / banner が再反映される。
- [x] 保存失敗時にエラー表示と再試行ができる。

## Constraints
- Perf: 即時反映のために不要な全量再取得へ依存しない。
- Security: 既存認証境界を維持し、保存先は既存 Firebase Storage を再利用する。
- Compatibility: 既存 profile API の `display_name/status_text/avatar_key` 契約を壊さず additive に `banner_key` を追加する。
