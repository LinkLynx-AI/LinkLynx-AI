# Prompt

## Goals
- `LIN-800` を parent run として進め、DM 1対1 の開始導線、履歴導線、FE 接続までを child issue 単位で成立させる。
- `LIN-824` / `LIN-827` / `LIN-830` を依存順で実装し、各 child を 1 issue = 1 PR で切り出せる状態へ持っていく。
- 実装、検証、レビューの証跡を parent run memory に集約する。

## Non-goals
- group DM の導入。
- DM 専用の別 SoR 導入。
- out-of-scope な UI 改修や event schema の破壊的変更。

## Deliverables
- DM open-or-create / list / detail API と participant 境界。
- DM 履歴取得 / 投稿の live 接続。
- FE の DM 一覧 / 会話遷移 / composer 実接続。
- `docs/agent_runs/LIN-800/` の run memory 4 ファイル。

## Done when
- [ ] `LIN-824` の acceptance criteria を満たす。
- [ ] `LIN-827` の acceptance criteria を満たす。
- [ ] `LIN-830` の acceptance criteria を満たす。
- [ ] 必須 validation と review gate の証跡が揃う。

## Constraints
- Perf: 既存 message / Scylla / WS 基盤を活かし、DM 用の別保存経路は増やさない。
- Security: 非参加者の参照/投稿を fail-close で拒否する。
- Compatibility: 既存 guild channel API と FE shell を壊さず additive に追加する。
