# Implement

- `Plan.md` を親 run の単一実行順として扱う。
- child issue は `LIN-824` -> `LIN-827` -> `LIN-830` の順に進め、未完了 child がある間は次へ進まない。
- diff は DM start/history/FE connection に閉じ、group DM や unrelated refactor を混ぜない。
- milestone ごとに validation を実行し、失敗したらその場で修正する。
- `Documentation.md` に判断、検証結果、既知の制約、PR 証跡を逐次記録する。
