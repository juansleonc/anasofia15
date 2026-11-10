# Orchestrate — Pipeline Shape (Parallel vs Serial)

Relocated from SKILL.md body (progressive disclosure). Unique value of this file: the
SHAPE of the pipeline — which phases fan OUT in parallel vs gate serially. Per-phase
subagent/model detail lives in SKILL.md's phase table; the sequential-dependency table
with reasons lives in [workflows.md's "Must Run Sequentially"
table](workflows.md#must-run-sequentially-dependencies).

```
▼  = serial gate (must complete before next step)
⇉  = parallel fan-out (N agents, same phase)
══ = BLOCKING gate (independent verifier, not the worker)

  Ideation ▼ Grill ▼ Architect
  ▼
  Static Analysis  ⇉⇉⇉⇉   (Phase 1A)
  ▼
  Domain Skills     ⇉⇉⇉⇉   (Phase 1B)
  ▼
  Gate 2.5 — Decompose
  ▼
  TDD (serial — one worker session)
  ▼
  ══ Gate 3.5 — VALIDATOR (blocking) ══
  ▼
  Validation         ⇉⇉⇉⇉   (Phase 2.5, if applicable)
  ▼
  Quality             ⇉⇉⇉    (Phase 3: coverage | lint | code-simplifier)
  ▼
  ══ Quality Gate ══
  ▼
  Publish (serial — gated on user y/n)
```
