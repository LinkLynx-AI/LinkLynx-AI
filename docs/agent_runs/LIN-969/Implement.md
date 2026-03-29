# Implement.md

## Notes
- dedicated pool は Autopilot で直接は作らず、workload-scoped isolation に翻訳する
- standard path は `StatefulSet + PVC + PDB` で baseline を作る
- Dragonfly は source of truth にしない
