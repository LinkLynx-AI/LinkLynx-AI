# Implement.md (Runbook)

- `LIN-805 -> LIN-809 -> LIN-815` の順を崩さない。
- 差分は rate-limit 基盤、REST 適用、runbook/metrics の 3 論理単位に保つ。
- 検証失敗時はその場で修正し、次のマイルストーンへ進まない。
- `Documentation.md` に判断・検証結果・既知制約を随時追記する。
