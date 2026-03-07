# LIN-905 Implement

- `Plan.md` の順序を実行順として扱う。
- 既存実装の引継ぎ元は `LIN-641` / `LIN-642` / `LIN-643` / `LIN-644` / `LIN-854` / `LIN-855` に限定する。
- 受け入れ条件を既に満たしている場合は、不要なコード変更を入れず evidence の整備を優先する。
- 追加修正が必要な場合は、login / protected route / ws identify の範囲から外れない。
- 検証結果、判断理由、runtime smoke 結果、review 結果を都度 `Documentation.md` に追記する。
