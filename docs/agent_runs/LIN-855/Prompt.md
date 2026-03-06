# LIN-855 Prompt

## Goal
- `/login` と `/register` に Firebase Google サインイン導線を追加する。
- Google サインイン成功時に既存導線と同様の完了遷移（`/channels/me`）を成立させる。
- Google サインイン失敗時に主要エラーをユーザー向け文言で表示する。

## Non-goals
- Apple/GitHub など他プロバイダの追加。
- 独自 OAuth 基盤の追加。
- LIN-642/LIN-644 の先取り実装（REST/WS 実接続拡張）。

## Deliverables
- `entities/auth` に Google popup サインイン API とエラー正規化を追加。
- `features/auth-flow` に Google サインイン UI とエラーメッセージ変換を追加。
- `login/register` の既存メール/パスワード導線を壊さず Google 導線を併設。
- `docs/agent_runs/LIN-855/*` の実行証跡更新。

## Done when
- [ ] `/login` `/register` で Google サインインを開始できる。
- [ ] Google 認証成功で `authenticated` 状態へ遷移し、principal 確保後に `/channels/me` へ遷移できる。
- [ ] 失敗ケース（popup 閉じる/拒否/ブロック）で適切なエラー表示が出る。
- [ ] 既存メール/パスワード導線の挙動が維持される。

## Constraints
- Perf: 不要な再描画・重複リクエストを増やさない。
- Security: ID トークンを localStorage/sessionStorage へ保存しない。
- Compatibility: 既存 `AuthProvider` / principal provisioning 境界に合わせる。

## Fixed decisions
- Google 認証方式は `signInWithPopup` のみ採用する。
- Google 認証後に `emailVerified=false` の場合は既存方針に合わせて `verify-email` へ誘導する。
