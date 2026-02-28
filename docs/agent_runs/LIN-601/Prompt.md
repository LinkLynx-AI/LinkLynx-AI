# LIN-601 Prompt

## Goal
- Fix v1 Event Stream baseline for Redpanda topic naming, retention, and replay operations.
- Keep the scope to backend contracts and runbook artifacts that downstream issues can consume.

## Non-goals
- Implement Redpanda cluster provisioning or runtime deployment automation.
- Replace JetStream as the Class A durability source.
- Implement ClickHouse/Search consumer applications in this issue.

## Done conditions
- Topic naming convention is documented and reviewable.
- Retention/partition baseline for durable and derived streams is documented.
- Replay/reprocess rules and guardrails are fixed.
- Broker outage behavior and data-preservation expectations are documented.
- Topic add/change operational procedure is documented in runbook form.
