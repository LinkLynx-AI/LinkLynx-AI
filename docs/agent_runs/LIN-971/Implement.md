# Implement.md

- standard path では provider resource provisioning ではなく connection contract の codification に寄せる
- Redpanda は extension stream path、NATS は realtime path として ADR-002 / LIN-601 の責務境界を維持する
- required secret inventory は Redpanda `bootstrap_servers` / `sasl_username` / `sasl_password` / `ca_bundle`、NATS `url` / `creds` / `ca_bundle` に固定する
- accessor は standard runtime GSA から opt-in で付与する
- smoke topic / subject は Terraform output と runbook で固定し、runtime 実装は後続 issue に残す
