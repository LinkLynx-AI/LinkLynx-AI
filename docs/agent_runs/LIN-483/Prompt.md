# LIN-483 Prompt

## Goal
- LIN-483 の子Issue（LIN-503, LIN-504）を順次実装し、UI Gateway契約とMock Adapter差し替え境界を確立する。
- API未接続の状態でも主要画面をUIレビュー可能にする。

## Non-goals
- API/DB/WS の実処理実装
- 認可/認証の本番判定ロジック導入
- 本番API adapter の実装

## Done Conditions
- LIN-503: Auth/Guild/Message/Moderation の UI Gateway interface が定義される
- LIN-504: mock adapter + factory が追加され、主要画面が gateway 境界経由で描画される
- 1 issue = 1 PR を順守し、LIN-503 -> LIN-504 の順で証跡を残す
