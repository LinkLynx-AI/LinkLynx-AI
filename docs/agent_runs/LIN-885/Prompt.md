# Prompt.md (Spec / Source of truth)

## Goals
- チャンネル画面左下ユーザーパネルの設定ボタンから通常導線で設定画面へ遷移できるようにする。
- 設定画面から 2 クリック以内でプロフィール編集画面へ到達できるようにする。
- 暫定のテスト用モーダル導線に依存せず、`/settings/*` の route 契約を実 UI に接続する。

## Non-goals
- プロフィール項目の追加や仕様変更。
- avatar / banner 保存処理の実装。
- 既存 server settings モーダル導線の作り直し。

## Deliverables
- ユーザーパネル歯車から `/settings/profile` へ遷移する通常導線。
- `/settings/profile` と `/settings/appearance` の実ページと共通 shell。
- `returnTo` を保持した close / ESC の戻り導線。
- LIN-885 スコープのテスト追加と検証結果の記録。

## Done when
- [ ] 歯車ボタンで設定画面が開く。
- [ ] プロフィール編集画面へ 2 クリック以内で到達できる。
- [ ] テスト用遷移ボタンを使わなくても導線が通る。
- [ ] 既存 server settings 導線に退行がない。

## Constraints
- Perf: 既存 channels 画面の不要な再描画や不要 fetch を増やさない。
- Security: `returnTo` は既存の protected route 正規化に従い、無効な値を許可しない。
- Compatibility: `APP_ROUTES.settings.*` と LIN-482 の settings shell 契約に沿う。
