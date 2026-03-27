# Staging Environment

この root は LIN-963 以降の staging infrastructure 用。

## 初期化

bootstrap apply 後に生成された `backend.hcl` を使う。

```bash
cd infra/environments/staging
terraform init -backend-config=backend.hcl
terraform plan
```

最初の LIN-962 時点では、backend と provider の雛形だけを用意している。
