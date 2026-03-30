# ADR Directory Guide

`docs/adr/` stores architecture decision records that define project-wide contracts and operational baselines.

- `ADR-001-event-schema-compatibility.md`: Event schema compatibility policy (additive changes only), deprecation/versioning rules, checklist, and rollback communication.
- `ADR-002-class-ab-event-classification-and-delivery-boundary.md`: Event Class A/B classification, v0/v1 delivery boundary, and outage/recovery responsibility SSOT.
- `ADR-003-search-consistency-slo-reindex.md`: Search consistency baseline, lag SLO/SLI, reindex trigger conditions, and completion criteria.
- `ADR-004-authz-fail-close-and-cache-strategy.md`: AuthZ fail-close baseline, REST/WS deny vs unavailable mapping, authorization cache TTL/invalidation strategy, and propagation SLO.
- `ADR-005-dragonfly-ratelimit-failure-policy.md`: Dragonfly outage rate-limit hybrid policy, degraded enter/exit thresholds, and recovery warm-up/resynchronization baseline.
- `ADR-006-phase1-edge-baseline-gcp-native-edge.md`: Phase 1 edge baseline, GCP native edge responsibility boundary, Cloudflare 不採用理由, and rollback order.
