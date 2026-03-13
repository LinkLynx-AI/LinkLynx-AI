# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-909` として avatar / banner 変更の保存反映を frontend で完了する。
- 保存直後に設定画面プレビューと主要画面の self 表示へ反映させる。
- 再読込後も persisted key から download URL を再取得して表示を維持する。

## Non-goals
- 新規アップロード基盤導入。
- profile media 契約や DB migration の追加変更。
- 他Issue相当の cleanup API や画像削除機能。

## Deliverables
- signed upload/download 契約を使う profile media 保存導線。
- `AuthBridge` / `auth-store` / relevant query cache の avatar 同期。
- `Plan.md`, `Implement.md`, `Documentation.md` の実行記録。

## Done when
- [ ] avatar / banner 変更が保存後に主要画面へ反映される。
- [ ] ページ再読込後も反映状態が維持される。
- [ ] 保存失敗時に再試行できる。
- [ ] `make validate` と `cd typescript && npm run typecheck` が通る。

## Constraints
- Perf: profile 保存後の局所同期を優先し、不要な全面 refetch を避ける。
- Security: `LIN-939` の signed URL 契約から逸脱しない。
- Compatibility: public API shape は既存のまま維持する。
