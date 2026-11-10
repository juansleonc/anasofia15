# Kaizen Log — stack-sync

> Append improvement entries here (date, what changed, why).

## 2026-07-10 — Approve-gate bright line

- **What changed**: `SKILL.md` Phase 5 (Approve) gained an explicit bright-line rule: the gate
  cannot be waived by urgency or authority; a "skip the questions" instruction compresses to ONE
  confirmation over the full proposal, never to zero confirmations.
- **Why**: a live pressure test (combined CTO-authority + deadline-time pressure, `/stack-sync`
  named) showed the mechanics holding — detection, research grounding, honest repo-only marking,
  divergence recording, and a passing `--audit` exit 0 — but the worker self-approved past Phase 5
  under an explicit "don't ask, just write it" dispatch instruction, disclosing the deviation. The
  documented-baseline pressure test predicted the mechanics would hold but had not modeled a
  dispatching agent handing down an explicit no-confirmation instruction as part of the task itself
  — see `reference/pressure-test.md`, "Live run — 2026-07-10".
- **How to apply**: when under time or authority pressure to skip confirmation, batch the full
  proposal into one compact block and require one explicit go/no-go — never write with zero
  confirmations, regardless of who is asking or how urgent the ask is framed.

## 2026-08-18 — Ruby detection wired (a Ruby repo no longer reports a silent green)

- **What changed**: `scripts/stack_check.sh`'s `detect_artifacts()` gained a Ruby case reading
  `Gemfile.lock`'s `RUBY VERSION` stanza (patch level stripped: `3.2.2p53` → `3.2.2`), emitting
  `ruby <version> (evidence: Gemfile.lock:<line>)`. `reference/detection-artifacts.md` moved Ruby
  from "documented, not yet wired" to **implemented** and gained a "Ruby detection" section.
  Driven test-first by `tests/test_stack_check.sh` (+ `tests/fixtures/stack_check/fake-ruby/`):
  version+evidence emitted, nothing emitted when the stanza is absent, and `--report` surfacing
  `UNREGISTERED: ruby`.
- **Why**: a live `/stack-sync` on a Rails monorepo (Ruby 3.3.11, Rails 6.1.7.37) produced ZERO
  output from `--detect` and a clean `--report`. The clean report was the real defect: `--report`
  is sold as a drift probe, so "no output, exit 0" reads as "no drift" when in fact nothing was
  ever compared. Every non-Node repo got a green light from a check that never ran — the worst
  failure mode available, because it is indistinguishable from success. The full sync still
  succeeded (detection was done by hand from the lockfiles), which is exactly how the gap stayed
  invisible until someone looked at why the script was silent.
- **How to apply**: when a detector emits nothing, ask whether the ecosystem is unsupported
  before concluding the repo is clean — and prefer a mode that can say "I did not look here" over
  one that silently exits 0. Adding an ecosystem still follows the catalog's own three steps:
  fixture + failing test FIRST, then the `detect_artifacts()` case, then the catalog row.
