# ADR-001 Event Schema Compatibility Rules (Additive Changes Only)

- Status: Accepted
- Date: 2026-02-26
- Related:
  - [LIN-580](https://linear.app/linklynx-ai/issue/LIN-580)
  - [LIN-581](https://linear.app/linklynx-ai/issue/LIN-581)
  - [LIN-582](https://linear.app/linklynx-ai/issue/LIN-582)
  - [LIN-583](https://linear.app/linklynx-ai/issue/LIN-583)
  - [LIN-584](https://linear.app/linklynx-ai/issue/LIN-584)

## Context

In the v0 foundation, event contracts must be fixed first so LIN-581/582/583/584 can proceed with a shared baseline.
If schema-change decisions depend on individual reviewers, we risk longer review time, contract inconsistencies, and missing runbook steps.
This ADR fixes a single compatibility policy shared by both v0 and v1.

## Decision

### 1. Core rules

- Breaking changes to existing events are prohibited.
- Allowed changes:
  - Adding optional fields
  - Backward-compatible extensions
  - Extensions where unknown fields can be safely ignored
- Prohibited changes:
  - Field removal
  - Making existing fields required
  - Type changes to existing fields
  - Semantic changes to existing fields
  - Event name rename/removal
  - Backward-incompatible changes to existing enum values

### 2. Rules for adding optional fields

- Every new field must define its default meaning.
- Before producer rollout, verify consumers still work without the new field.
- Record checklist evidence that non-updated consumers remain safe.

### 3. Deprecation rules

- States are managed as `Proposed -> Deprecated -> Removal Candidate -> Removed (major only)`.
- Read compatibility must be maintained during `Deprecated`.
- Removal is allowed only in a major version.

### 4. Versioning policy

- `major`: Breaking change. Prohibited by default. Exceptions require a separate ADR and explicit approval.
- `minor`: Additive backward-compatible change.
- `patch`: Wording/behavior clarification only (contract meaning unchanged).
- The same policy applies to both v0 and v1.

## Shared checklist for Class A/B (reviewable within 30 minutes)

1. Compatibility check
- Is the change additive-only?
- Does it avoid prohibited changes (removal, requiredness change, type change, semantic change, rename)?

2. Consumer impact check
- Do non-updated consumers continue to work?
- Are expected consumers and impact assessment recorded?

3. Monitoring and rollback readiness
- Are incompatibility detection conditions linked to monitoring?
- Are rollback owner and execution steps explicitly documented?

4. Documentation update scope
- Are affected ADR/contract/runbook documents listed?
- Are all reference links valid?

5. Review record
- Are decision rationale, concerns, and open items recorded?
- Is the write-up concise enough for a 30-minute decision?

## Application examples (three existing events)

### 1. `MessageCreated` (PASS example)

- Proposed change: add optional field `metadata`.
- Decision: PASS because existing field meaning/type/requiredness is unchanged.
- Condition: when consumers are not updated, they must ignore `metadata` and continue existing behavior.

### 2. `MessageUpdated` (PASS example)

- Proposed change: add optional field `edit_reason`.
- Decision: PASS because backward compatibility is preserved.
- Condition: behavior remains unchanged when `edit_reason` is missing.

### 3. `MessageDeleted` (PASS example)

- Proposed change: add optional field `delete_reason_code`.
- Decision: PASS because this is additive-compatible.
- Condition: default meaning for missing value must be documented (for example, "reason not set").

## Breaking-change sample (FAIL detection)

- Sample: change `MessageCreated.content` type from `string` to `object`.
- Detection result: FAIL because it is a type change on an existing field.
- Action: reject the change; if needed, represent it via a new optional field or a new event.

## Incident handling for contract incompatibility

### 1. Detection conditions

- Consumer deserialization failure rate exceeds threshold.
- Compatibility violations (prohibited changes) found after review.
- Monitoring shows sustained event-processing failures.

### 2. Temporary stop conditions

- If a compatibility violation is likely to impact production, stop rollout of the relevant change.
- To prevent blast radius, temporarily pause producer emission when necessary.

### 3. Rollback steps

1. Stop or rollback the latest change at deployment-unit granularity.
2. Return to the last known compatible version.
3. Identify impact scope (consumers/topics/time range) and decide whether replay is required.

### 4. Communication steps

1. Share impact scope and temporary mitigation with relevant channels.
2. Communicate estimated recovery time and next update time.
3. Record prevention actions after recovery completion.

### 5. Resume conditions after recovery

- Checklist re-evaluation is PASS.
- Monitoring metrics are back to normal range.
- Change owner and reviewer both approve resume.

## Related issue references

- LIN-581/582/583/584 must reference this ADR as a prerequisite.
- Follow-up ADRs must include checklist results and versioning decision derived from this ADR.

## Consequences

- Event-contract reviews use one shared decision baseline.
- Breaking changes are prevented during review.
- Shared v0/v1 operation reduces migration rework in later phases.
