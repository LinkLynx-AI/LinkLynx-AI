# Documentation.md (Status / audit log)

## Current status
- Now: Terraform / workflow / docs の baseline 実装と validation が完了
- Next: self-review を反映して commit / push / PR を作る

## Decisions
- service account key は使わず、GitHub OIDC + Workload Identity Federation を使う
- runtime project ごとに `application-images` repository を 1 つ置き、service path で `rust` / `typescript` / `python` を分ける
- publisher service account は environment ごとに分け、`staging` / `prod` で IAM を分離する
- image 参照は immutable tag と digest を baseline にする
- build は local image を先に作り、OIDC access token は push 直前に取得して 5 分制限の影響を減らす
- 脆弱性検知は `containerscanning.googleapis.com` と `Trivy(HIGH,CRITICAL fail)` の二段で持つ

## How to run / demo
- `terraform apply` は bootstrap -> runtime environment の順で実行する
- bootstrap output から次を GitHub Actions へ設定する
  - repository variable: `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - environment variable: `GCP_ARTIFACT_PUBLISHER_SERVICE_ACCOUNT`, `GCP_ARTIFACT_REGISTRY_PROJECT_ID`
- GitHub Actions `CD` workflow を `workflow_dispatch` で `staging` or `prod` に流し、artifact summary の digest を確認する
- protected branch merge 後は `main` push で `prod` publish が走る

## Known issues / follow-ups
- GitHub repository / environment variables を設定しないと TypeScript image build は完走しない
- Artifact Registry repository apply と Actions 実行には実 GCP credentials が必要
- image copy による staging -> prod promotion 自動化はこの issue では未実装
- local runtime smoke (`docker compose build rust typescript -> /health`) は既存 build context が 5GiB 超まで膨らみ、`.dockerignore` 改善なしでは現実的な所要時間に収まらなかった
