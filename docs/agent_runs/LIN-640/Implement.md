# LIN-640 Implement Rules

- Keep scope limited to Auth FE foundation only (LIN-640).
- Preserve existing route skeleton behavior and query-driven preview contract.
- Follow FSD boundaries: `features` must not depend on `widgets`, and shared libs stay domain-agnostic.
- Expose only minimal public API needed by downstream LIN-641/LIN-642.
- Prefer additive changes; avoid unrelated refactors.
