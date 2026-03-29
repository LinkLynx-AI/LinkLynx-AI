# Implement.md

## Scope
- Cloud Armor backend security policy を `rust-api-smoke` backend に attach する
- low false-positive な preconfigured WAF baseline を追加する
- low-budget security runbook と docs を整備する

## Non-goals
- DAST / bot management / VPC-SC / IAP
- 標準 path の full security baseline
- 既存 CI scan baseline の全面刷新
