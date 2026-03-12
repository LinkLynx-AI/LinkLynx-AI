# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-933` として theme 設定の取得・更新・永続化を settings 画面から成立させる。
- 保存済み `theme` を再読込後に初期反映し、保護画面全体で light/dark が切り替わるようにする。
- backend 既存契約 `/users/me/profile.theme` (`dark | light`) を frontend と runtime に正しく接続する。

## Non-goals
- 新しい theme 種別の追加。
- デザインシステム刷新。
- 認証画面の見た目最適化。

## Deliverables
- `/settings/appearance` の保存可能な theme UI。
- `next-themes` を使った light/dark の root 適用。
- profile 同期時に theme を store / runtime へ反映する仕組み。
- `docs/agent_runs/LIN-933/` の実行記録。

## Done when
- [ ] `theme` を settings 画面から保存できる。
- [ ] 保存直後に保護画面 UI が light/dark へ切り替わる。
- [ ] 再読込後も保存済み theme が初期反映される。
- [ ] `make validate` と `cd typescript && npm run typecheck` が通る。

## Constraints
- Perf: profile query / mutation の既存同期経路を再利用し、不要な追加 fetch は避ける。
- Security: theme 許容値は backend 契約の `dark | light` のみ扱う。
- Compatibility: `/users/me/profile` API 形状は変更しない。
