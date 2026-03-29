# Implement.md (Runbook)

- Follow `Plan.md` as the execution order. If the order changes, update `Plan.md` and record the reason in `Documentation.md`.
- Keep the diff small and avoid runtime feature refactors.
- Prefer opt-in or low-noise controls for standard path security; do not add a noisy global gate without documenting the tradeoff.
- Update `Documentation.md` as decisions become fixed.

## LIN-973 execution notes

1. Reuse existing low-budget security baseline patterns where they fit the standard path.
2. Attach `Cloud Armor` at the standard GitOps workload edge instead of inventing a parallel ingress path.
3. Expand CI in a low-noise way:
   - dependency review on PR diffs
   - Semgrep on changed application files only
   - keep image scan aligned with existing Trivy usage
4. Treat DAST as a manual baseline gate until a stable authenticated smoke target exists.
5. Document fail-close / fail-open boundaries explicitly and tie them back to ADR-004 / ADR-005.
