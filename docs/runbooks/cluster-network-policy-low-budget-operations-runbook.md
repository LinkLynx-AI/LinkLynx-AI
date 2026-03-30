# Cluster Network Policy Low-budget Operations Runbook

## Purpose

low-budget `prod-only` path の cluster 内 ingress 面を最小限で絞り、`rust-api-smoke` と `dragonfly` の namespace 間通信だけを明示する。

## Baseline

- `rust-api-smoke`
  - default deny ingress
  - TCP `8080` のみ許可
- `dragonfly`
  - default deny ingress
  - TCP `6379` を `rust-api-smoke` namespace からのみ許可

この baseline は narrow ingress isolation に限定する。egress 制御、cluster-wide default deny、Pod Security Admission は含めない。

## Preconditions

- `prod` cluster が作成済み
- `rust-api-smoke` workload が deploy 済み
- `dragonfly` baseline を使う場合は `enable_minimal_dragonfly_baseline = true`

## Verify

### 1. NetworkPolicy resources

```bash
kubectl get networkpolicy -A
kubectl describe networkpolicy -n rust-api-smoke
kubectl describe networkpolicy -n dragonfly
```

期待値:

- `rust-api-smoke` namespace に `default deny ingress` と `allow-http-ingress`
- `dragonfly` namespace に `default deny ingress` と `allow-client-ingress`

### 2. Rust API health

```bash
kubectl get pods -n rust-api-smoke
kubectl logs -n rust-api-smoke deploy/rust-api-smoke --tail=100
curl -fsS https://<api-hostname>/health
```

期待値:

- `rust-api-smoke` Pod が `Ready`
- `/health` が `200`

### 3. Dragonfly positive path

`rust-api-smoke` namespace から Dragonfly port へ到達できることを確認する。

```bash
kubectl run -n rust-api-smoke dragonfly-netcheck \
  --rm --restart=Never --image=busybox:1.36 \
  --command -- sh -c 'nc -vz dragonfly.dragonfly.svc.cluster.local 6379'
```

期待値:

- `succeeded` または `open`

### 4. Dragonfly negative path

許可していない namespace からの接続が拒否されることを確認する。

```bash
kubectl run -n default dragonfly-netcheck \
  --rm --restart=Never --image=busybox:1.36 \
  --command -- sh -c 'nc -w 5 -vz dragonfly.dragonfly.svc.cluster.local 6379'
```

期待値:

- timeout または connect failure

## Triage

### Rust API became unhealthy

1. `kubectl describe networkpolicy -n rust-api-smoke`
2. `kubectl describe pod -n rust-api-smoke`
3. `curl https://<api-hostname>/health`
4. rollback して service recovery を優先する

### Dragonfly clients cannot connect

1. client namespace が `allowed_client_namespaces` に含まれているか確認する
2. `kubectl get netpol -n dragonfly -o yaml`
3. `kubectl run` で positive / negative path を再確認する
4. 必要なら一時 rollback して ADR-005 / session-resume runbook の degraded path に寄せる

## Rollback

最小 rollback は module から NetworkPolicy resource を戻して `terraform apply` すること。

運用上は次の順で戻す。

1. `rust-api-smoke` の `/health` が落ちている場合は Rust API 側 policy を先に rollback
2. Dragonfly client outage が続く場合は Dragonfly 側 policy を rollback
3. rollback 後に `kubectl get networkpolicy -A` と `/health` を再確認する

## Follow-up boundary

- namespace / workload ごとの finer-grained allowlist
- egress policy
- cluster-wide default deny
- Pod Security Admission

これらは standard path 側の cluster hardening issue へ渡す。
