# Implement.md

- standard path では runtime workload がまだないため、ScyllaDB Cloud cluster 自体の provision ではなく connection contract を Terraform で固定する
- Secret Manager inventory は `username` / `password` / `ca_bundle` を required set にする
- accessor は standard path の runtime GSA から opt-in で付与する
- contact points / keyspace / timeout / shard-aware-port posture は Terraform input と output contract で残す
- backup / restore / self-managed fallback は runbook と README で責務分界を明示する
