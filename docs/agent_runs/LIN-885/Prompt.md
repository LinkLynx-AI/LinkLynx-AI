# Prompt.md (Spec / Source of truth)

## Goals
- LIN-885 として、チャンネル画面左下ユーザーパネルの設定ボタンからユーザー設定画面を開けるようにする。
- 既存のユーザー設定画面からプロフィール画面へ通常導線で到達できる状態を保証する。
- テスト用ショートカットに依存せず、既存の設定導線を壊さない。

## Non-goals
- 新規 `/settings/*` route 実装。
- プロフィール項目の追加や仕様変更。
- アバター/バナー保存処理の実装。

## Deliverables
- `UserPanel` の歯車ボタンから `user-settings` modal を開く実装。
- 通常導線からプロフィール設定へ 2 クリック以内で到達できることを固定するテスト。
- LIN-885 スコープの検証結果とレビュー結果の記録。

## Done when
- [x] ユーザーパネルの設定ボタンでユーザー設定画面が開く。
- [x] 開いた設定画面からプロフィール画面へ到達できる。
- [x] 既存のサーバー設定導線に退行がない。

## Constraints
- Perf: 既存 store/modal 契約を再利用し、不要な状態追加をしない。
- Security: 認証済み protected UI の既存導線のみを使う。
- Compatibility: `server-settings` / `user-settings` の既存 modal 契約を維持する。
