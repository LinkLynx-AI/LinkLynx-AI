# Prompt.md (Spec / Source of truth)

## Goals
- LIN-807として、設定画面プロフィール（表示名/自己紹介）を実APIへ接続する。
- 更新成功/失敗（再試行可能）をUI上で明示する。
- 更新結果を設定画面プレビューとユーザーパネル表示へ反映する。

## Non-goals
- 新規設定項目の追加。
- avatar画像アップロード経路の新規実装。
- テーマ切替導線の実装完了。

## Deliverables
- `/users/me/profile`（GET/PATCH）を呼び出す frontend API 実装。
- `useMyProfile` / `useUpdateMyProfile` hooks 実装。
- 設定画面 `UserProfile` からの更新導線実装（成功/失敗/再試行）。
- LIN-807 スコープのテスト追加と検証結果の記録。

## Done when
- [x] 設定画面からプロフィール更新ができる。
- [x] エラー表示に再試行導線がある。
- [x] 更新結果が画面（プロフィール設定・ユーザーパネル）へ反映される。

## Constraints
- Perf: 既存導線の不要な再描画/再フェッチを増やさない。
- Security: 既存の認証付き API 呼び出し経路を踏襲する。
- Compatibility: LIN-804のAPI契約（display_name/status_text/avatar_key）に準拠する。
