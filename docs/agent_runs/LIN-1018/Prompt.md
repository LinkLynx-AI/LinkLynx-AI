# Prompt.md

## User request
- 次のインフラ issue を順番に実装する
- 現在の low-budget `prod-only` path を維持する

## Target issue
- `LIN-1018` `[12a] prod-only path の Cloud Monitoring baseline と alert routing を整備する`

## Constraints
- `1 issue = 1 PR`
- `Prometheus + Grafana` ではなく GCP native な最小監視線に寄せる
- Discord forwarder や self-hosted observability stack までは広げない
