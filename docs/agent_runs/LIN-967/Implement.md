# Implement.md

## Notes
- Terraform では controller install を担当する
- Argo CD custom resources は CRD timing を避けるため repo 側 bootstrap manifest として管理する
- prod gate は automated sync を切ることで manual approval 相当を成立させる
