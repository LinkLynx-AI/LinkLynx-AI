# LIN-644 Implement

## Execution policy
- Plan.md の順序を実装順序のSSOTとする。
- scope外変更は行わない。
- 各マイルストーンごとにテスト実行し、失敗時は即修正する。

## Progress log
- 2026-03-04: LIN-644 要件と依存Issue/LIN-643サーバ契約を確認。
- 2026-03-04: `entities/auth` に WS 接続状態モデル、`issueWsTicket`、`signOutCurrentUser` を実装。
- 2026-03-04: `WsAuthBridge` を実装し、`Providers` に組み込み。
- 2026-03-04: レビュー指摘対応として、ws-ticket エラーの再試行可否分類修正・WS多重接続ガード・バナーa11y/live-region・動的カウントダウンを追加。
- 2026-03-04: `make validate` を再実行し、全チェック通過を確認。
- 2026-03-04: Claude Code の改善提案対応として、`connect` の責務分割（ticket失敗処理/WSイベント処理を分離）と `NEXT_PUBLIC_API_URL` の userinfo 拒否検証を追加。
