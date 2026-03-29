# Documentation.md (Status / audit log)

## Current status
- Now: validation 完了。PR / Linear 更新前の self-review 段階
- Next: commit / push / PR / Linear コメント

## Decisions
- rust-api は ingress-only baseline として TCP 8080 のみ許可する
- Dragonfly は ingress-only baseline として `rust-api-smoke` namespace からの TCP 6379 のみ許可する
- egress 制御や cluster-wide default deny はこの issue に入れない

## How to run / demo
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `kubectl get networkpolicy -A`

## Known issues / follow-ups
- kubelet probe と provider implementation の相互作用は cluster 実機で verify が必要
- Dragonfly を使う namespace が増えた場合は `allowed_client_namespaces` を明示的に増やす
- runtime smoke は GCP credentials / cluster access がこの workspace にないため未実施
