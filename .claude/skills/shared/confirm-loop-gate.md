---
name: confirm-loop-gate
description: Canonical confirm-loop gate shared by /adversarial-review (findings I generate) and /orchestrate's inbound-review-feedback triage pattern (findings others — humans/Bugbot/CodeRabbit/Greptile — generate on a PR). Gate each finding before acting — real + in-scope + reproducible — and terminate on 2 clean passes, never blind.
---

# Confirm-Loop Gate

> One authoritative copy. Both `/adversarial-review` (findings I generate) and
> `/orchestrate`'s inbound-review-feedback triage pattern (findings others — humans/Bugbot/CodeRabbit/Greptile —
> generate on a PR, gated coordinator-direct before dispatch to a `/tdd` worker) run THIS loop.
> Each consumer adds its own framing on top; the gate mechanics below are shared.

Iterate to resolution as a **GATED loop, never blind**:

1. **Gate each finding before acting** — keep only findings that satisfy ALL three:
   1. **Real** — a genuine defect/improvement, not a style nit pattern-matched (especially by a bot).
   2. **In-scope** — introduced by the change under review, scoped per [Diff Scope](../shared/diff-scope.md) (variant `content`; the loop usually runs before anything is committed, so a `HEAD`-anchored diff would be empty). Pre-existing legacy code a finding flags is usually out-of-scope; say so, don't silently fix unrelated lines.
   3. **Reproducible** — provable WITHOUT runtime instrumentation (no monkey-patch, no injected `raise`/`rescue`, no stub on private methods). Data setup (fixture/factory helpers, direct column updates) is allowed; runtime code modification is not.

   Discard theoretical / out-of-scope items with a one-line technical reason. Don't amplify a false positive just because a bot (or my own lens) raised it.

2. **Confirm by finding type** — route corroboration to the right oracle:
   - **code/logic** → reproduce LOCALLY with a failing test first (a real request exercising the actual code path, not a test runner + stub standing in for it).
   - **API/library usage** → docs research via your docs tool (a negative docs result is low-confidence; verify against a signature dump before asserting absence).
   - **prod-state / "does this happen, at what scale"** → per stack.md#observability (skip and declare it if the project has no oracle — production-state findings are unverifiable from within the repo alone).

   MCP tools = MANUAL corroboration aids, never automated oracles. Use ≥2 independent sources on load-bearing claims.

3. **Document each CONFIRMED case** in `investigations/<ticket>/findings.md` (gitignored).

4. **Terminate on 2 consecutive clean passes** or a hard cap — not infinite.

5. **Autonomy ends at the action gate**: auto up to confirmed + documented + fix-proposed; commit / push / destructive / outward-facing actions stay manually approved.
