# Kaizen Log — orchestrate

> Append improvement entries here (date, what changed, why).

This is a fresh adaptation for this project (adapted from a sibling project's mature version of this
skill). No project-specific Kaizen history yet — start logging as real orchestration runs surface
lessons here.

<!-- Kaizen: 2026-07-09 - Bootstrap -->
- Framework bootstrapped: 17 skills, 4 agents, 10 opsx commands, stack adapter, installer. First coordinator→worker dispatch verified in the self-hosted repo.

<!-- Kaizen: 2026-07-10 - superpowers-adoption token diet -->
- Observed: the reusable dispatch template was bulk-pasting validation contracts, whole prior-research files, and the entire orchestration-log into every subagent prompt — real orchestration token burn that scales with ticket size instead of staying flat.
- Fix: contracts and prior research are now passed by file REFERENCE (path only, "read ONLY the ## STATE block and the last 2 ledger entries" for the log) instead of pasted; every dispatch now carries a mandatory `MODEL:` line so tier choice is explicit, not inherited; RETURN defaults to one line per PASSING contract with full evidence reserved for failures.
- Why this matters: obra/superpowers measured a **-50%** token reduction and ~2x speed from file-based handoff plus mandatory per-dispatch model tiering (spike-report.md) — the same shape of waste this template had before this fix.
- Source: `investigations/superpowers-adoption/adoption-design.md` Decision 2.

<!-- Kaizen: 2026-07-10 - verify-once-per-phase efficiency doctrine -->
- Observed: a full day of orchestration showed each worker re-running the entire test suite plus the full `qa_audit.sh` in its own closing steps — ~5x redundant green across a single phase — and sonnet-tier workers spending their whole dispatch on pure dictation (recording another agent's already-reported result back into the log).
- Rule: verify once per phase — workers report only their OWN delta (what they changed, its own RED→GREEN); full suites/audit runs live at gates, not inside every worker's closing. Closing/transcription dispatches (recording another agent's result verbatim) go to a haiku-tier session, or fold directly into the original agent's own RETURN instead of a separate dispatch.
- How to apply: the reusable dispatch template's RETURN section asks for the worker's own delta only; the coordinator's gates (not individual workers) own running the aggregates.
- Why this matters: redundant full-suite/full-audit reruns and pure-dictation dispatches burn sonnet-tier tokens on work that adds no new information — the gate already re-verifies the aggregate once per phase boundary.

<!-- Kaizen: 2026-07-22 -->
**Long test suites stall background agents; `timeout` does not exist on macOS.** During the prime-directive-fixes run, both the worker and the validator hit the 600s stream watchdog while running `tests/run.sh` (the suite legitimately exceeds it), and the coordinator's mitigation — instructing `timeout 120 bash <suite>` — made it worse: macOS has no `timeout` binary (exit 127), which stalled the validator twice more. Lessons for dispatch prompts: (1) never instruct GNU `timeout` — it is not portable to macOS; bound long runs by running suites individually or accepting a declared partial result; (2) instruct agents up front that a suite they cannot run gets declared honestly at the evidence rung earned (`static-only`/`blocked`), never retried into a stall; (3) a stalled agent is recoverable — SendMessage-resume preserved full context and completed the validator across 3 resumes at a fraction of a fresh re-dispatch's cost. Consider a stack.md#commands note documenting the suite's real runtime so future dispatches budget for it.

<!-- Kaizen: 2026-09-05 - resource isolation as the second axis of parallel safety -->
**Source isolation is not resource isolation.** A comparative audit against a sibling repo's parallel-agent skill found dojo stronger on nearly every mechanism (declared write sets, pairwise disjointness as a precondition, return-subset verification, evidence ladder, parent-verifies-integration) but missing one axis: dojo partitioned *files* and said nothing about the *runtime* two parallel agents execute in. Live evidence the same session: two workers deadlocked waiting on `until ! pgrep -f 'tests/run.sh'`, because the pattern matches the waiting shell's own command line — a shared-process-namespace collision that a resource-isolation rule would have made the author think about. Fix: a sibling callout to the write-set discipline ("Parallel executors — source isolation is not resource isolation") that is checkable at dispatch time, points at `stack.md#test-conventions`/`#commands` for what this project's shared resources actually are, and forces one of three outcomes per contended resource — distinct identity, serialize, or sole owner. dojo's own `stack.md` parallel-safety fill was stale (`N/A — no parallel execution yet`) and now records the real answer, including the `pgrep` bracketing workaround.
<!-- Kaizen: 2026-10-19 - User correction -->
- Rule: A design question raised mid-orchestration (adopting an external phase/pipeline proposal, whether it fits the delivery plan, re-ordering phases) is dispatched to the `architect` agent; the coordinator neither performs the gap analysis itself nor puts unvetted options to the user. Only decisions the architect flags as the user's go to `AskUserQuestion`, with the architect's recommendation.
- Why: design is architect work (pinned reasoning tier, written ADR, file:line evidence); a coordinator-authored analysis bypasses that bar and asks the user premature questions.
- How to apply: on any "how does X fit / how should the steps be" request during a run → architect dispatch (read-only on in-flight files) → relay its user-flagged decisions.
- Source: User correction on 2026-10-19. See auto-memory `feedback_coordinator-delegation.md`.

<!-- Kaizen: 2026-11-09 --> Phase 4 Publish: before the user y/n for a first push that contains `.github/workflows/*`, the coordinator should have a read-only check of `gh auth status` for the `workflow` scope and, if missing, ask the user to run `! gh auth refresh -h github.com -s workflow` together with the y/n, instead of discovering the OAuth rejection mid-push (cost one blocked worker round-trip on ANASOFIA15). Also: a personal-email literal inside a secrets e2e guard leaks the very data it protects once the repo goes public — guards should forbid the pattern (any email) with an empty allowlist, never embed the value.
