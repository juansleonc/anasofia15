---
name: adversarial-review
description: Use when reviewing a code change, validating a fix, or before declaring any implementation correct — especially migrations, backfills, or bulk deletes.
allowed-tools: [Read, Grep, Glob, Bash, Agent]
disable-model-invocation: false
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Adversarial Review

This is a multi-agent review. Run **Step 0** yourself first, then launch the agents IN PARALLEL using the Agent tool, passing each the diff and scope from Step 0. Aggregate their findings and present a unified verdict.

## Workflow (Step 0 — run BEFORE launching any agent)

These steps are not optional. They were learned the hard way (see Kaizen log) and are the difference between findings the author can act on and theory that wastes their time.

**0.1 — Map the change surface.** Take the stat summary and the full patch per [Diff Scope](../shared/diff-scope.md), variant `content` — including its untracked-file query, since a review that runs before the commit gate sees new files no diff reports. Only behavior *introduced by this diff* is eligible for the verdict. Pre-existing behavior goes to NOTES, never the verdict. Paste the diff stat into every agent prompt so each knows the exact scope.

**0.2 — Detect destructive data operations.** Grep the diff for any of: schema-migration files, `delete_all` / `destroy_all` / `update_all`-style bulk mutation calls, raw `DELETE` / `UPDATE` / `TRUNCATE` SQL, scripts/jobs/tasks that mutate rows in bulk, bulk cache-touch / reindex fanouts. **If any match → also launch Agent 4 (Destructive-Data Auditor)** alongside the three core agents. If none match, skip Agent 4.

**0.3 — Finding filter (hard gate before the verdict).** Every candidate finding must satisfy ALL three:
1. **Introduced by this diff** (Step 0.1), not pre-existing on the base branch.
2. **Reproducible WITHOUT runtime instrumentation** — no monkey-patch, no injected `raise`, no forced `rescue`, no stub on private methods of manually-allocated objects. Data setup (direct column writes, fixtures) is allowed; runtime code modification is not.
3. **Reflects a state that exists in prod** — verify BEFORE fabricating, using the project's observability oracles per `../shared/stack.md#observability` (e.g. an analytics-store query for row counts, or a recurring error-tracker fault on the same path). If 0 rows / 0 faults match, the state is impossible in prod → the finding is theoretical. **If the project has no observability oracle, production-state claims are unverifiable — label them `theoretical` explicitly; never fake a verification you cannot run.**

Any finding failing any of the three → demote to a NOTES section labeled `pre-existing` or `theoretical (no real repro)`. Final filter every verdict finding must pass: *"Does a real user, with real data, in a real client flow, observe this?"*

**Severity label (real vs theoretical)**: tag every surviving finding `WARNING(real)` (a normal, intended usage path triggers it) or `WARNING(theoretical)` (only a contrived, malicious-out-of-threat-model, or impossible path triggers it). This is a different axis from criterion 3 above: criterion 3 asks whether the underlying *state* exists in prod (if not, the finding is demoted entirely to NOTES and never reaches the verdict); the severity label applies only to findings that already passed criterion 3 and asks whether the *trigger path* to that state is something a normal user does, or only a contrived/adversarial one. `WARNING(theoretical)` findings are listed separately and never block a verdict alone — this refines, not replaces, the three-part filter and final filter above.

**0.4 — Real-request repro for network-facing code.** For API resolvers/handlers, controllers, middlewares, and endpoint-triggered background jobs, the default repro is a real request (an HTTP client call or an integration-level test hitting the real route) BEFORE any script-console/runner-based reproduction. Runner + monkey-patch bypasses resolver order, middleware, auth, and per-request shared context — exactly where many real bugs live. Runner-only repro is acceptable only for purely internal services with no network entry. For aliased-query or field-collision findings, confirm a real client (mobile/web/external API) actually emits the pattern (grep the client repo) — a request you hand-craft to force a collision is construction, not observation.

## Launching the agents

- Launch each agent with `subagent_type: "Explore"` — read-only (no Edit/Write/NotebookEdit), which is what a review must be. Explore can still run `git diff`, grep for sibling write paths, read files, and run read-only observability queries. Note on subagent_type: when the orchestrator dispatches the adversarial-review session as a whole, it uses `subagent_type: "validator"` (Gate 3.5 in the `orchestrate` skill's Phase table, if the project has that skill). These are consistent — the session is a validator; each internal reasoning lens it spawns is an Explore (read-only). A reader of both skills should expect this: "validator" describes the session's role in the pipeline, "Explore" describes the individual lens agents within that session.
- Pass a stronger reasoning-tier model explicitly on EVERY lens dispatch (see `../shared/stack.md#analysts` for what's configured for this project). The lenses do reasoning-based failure construction — the highest-leverage model spend in the pipeline — and without the override they inherit the session model (a lighter-weight session model would silently run the lenses degraded). This is deliberate asymmetry with cheap pattern-scan analysts elsewhere in the pipeline: the model follows the task nature, not the agent type.
- **Feed each lens RAW EVIDENCE, not your distilled summary.** Pass the original inputs (raw diff, raw research reports, raw files) alongside the attack framing. Seeing the conclusion you reached is fine — creator-verifier design plus adversarial framing neutralizes anchoring on the thesis. The bias that leaks is SHARED-PREMISE: a lens that sees only your summary inherits your reading of the facts and can contest only your thesis, not the facts themselves. Invariant/fact-checker lenses → pass explicit claims against objective ground truth. Inverter/reasoning lenses → conclusion + attack framing + raw inputs. For a load-bearing decision, add a BLIND independent pass (a fresh lens concludes from raw inputs without seeing yours) and then reconcile.
- Give each agent a focused, single-responsibility role (its section below is the prompt). Paste the Step 0.1 diff stat + the relevant diff into each prompt template where it says `[PASTE DIFF OR CONTEXT HERE]`.
- The agents run independently and report back; you (the orchestrator) aggregate. They do not talk to each other. If a future review genuinely needs agents to challenge each other's findings or share state, *agent teams* are the documented next step — not needed here; independent agents + aggregation is simpler and sufficient.

## When to use (project-specific)

✅ **Use for**:
- Financial code paths (payments, billing, accounting)
- State-machine / policy / permission changes (authorization rules, role/policy engines)
- Refactors that *remove* protective code (guards, validations, scopes)
- Changes touching multiple write paths to the same data
- Destructive / large-scale data operations — migrations, backfills, bulk delete/update/reindex jobs (these additionally trigger Agent 4)
- Before declaring any fix complete on high-stakes code paths

❌ **Skip for**:
- Typos, copy, cosmetic/UI changes, docs, config
- Pure renames / dead-code removal
- Cases already fully covered by a matching project skill if present (e.g. a dedicated multi-tenancy, timezone, or compliance validator)

This skill complements `code-review` — that one is grep/pattern-based, this one is reasoning-based failure construction. Run them in series when the stakes justify it.

## Shared Principles (apply to ALL agents)

### Inversion (Munger)
Do not ask "does this work?" Ask "how does this fail?" Correctness is better found by eliminating what is wrong than by confirming what seems right.

### Via Negativa (Taleb)
Improve by removing flaws, not by adding confidence. What you take away matters more than what you add.

### Map Is Not Territory (Korzybski/Munger)
Your mental model of the code is not the code. Your trace is not the execution. Verify against the territory, not your map of it.

### Signal vs Noise (Shannon)
Not all information is signal. Distinguish what matters for correctness from what merely looks relevant. High entropy means more uncertainty — high-entropy areas need more verification, not less.

### The Constraint Governs the System (Goldratt)
The system fails at its weakest point, not its average point. Find the constraint. Everything else is noise until the constraint is addressed.

### Second-Order Effects (Munger)
Every change has consequences beyond its intent. Ask: what does this change make possible that was previously impossible — both good and bad?

### Conservation (Physics)
Nothing is created or destroyed, only transformed. If something appears or disappears in the system (a state, a record, a side effect), trace where it came from or where it went. Unexplained appearances or disappearances are bugs.

### Entropy Increases (Thermodynamics)
Systems degrade toward disorder over time. Code that depends on everything going right is fragile. Reason about what happens as the system ages, accumulates edge cases, and drifts from initial assumptions.

### Declared engineering principles
Two of dojo's declared principles are review lenses at this gate. Each is stated once, in `../shared/principles.md`; apply it from there:
- [P1 — fail closed](../shared/principles.md#p1--fail-closed-on-unrecognized-input): for every input the change accepts, construct one it does not recognize and trace what happens to it.
- [P7 — an estimate is not a ceiling](../shared/principles.md#p7--an-honest-estimate-is-not-an-enforced-ceiling): ask its lens question of every number the change enforces.

---

## Agent 1: The Inverter

**Role**: For every claim of correctness, construct its negation. Your only job is to try to make things fail.

**Principles to apply**:

- **Proof by Contradiction (Mathematics)**: Assume the opposite of what is claimed and derive a consequence. If you reach an absurdity, the claim holds. If you reach a plausible failure, you have found a bug.
- **Pre-Mortem (Klein)**: The worst outcome has already happened. Work backwards to find the cause. Do not ask "could this happen?" — trace the path that made it happen.
- **Doubt-Avoidance Defense (Munger)**: Uncertainty is uncomfortable. The mind resolves it by concluding quickly, not correctly. When you feel "this is fine" — that is the moment to push harder.
- **Inconsistency-Avoidance Defense (Munger)**: Prior conclusions distort new evidence. If a previous analysis said "correct," that is reason to scrutinize more, not less.
- **Observer Effect (Physics)**: Your act of reviewing may change your perception of the system. The code you traced in your head is not the code that executes. Re-derive, don't recall.

**Prompt template for this agent**:
```
You are the Inverter. Your job is to BREAK this code, not confirm it.

For each claim of correctness in these changes, attempt to construct a concrete failure scenario step by step.
If you succeed: you found a bug. Describe the exact path.
If you fail: state which specific mechanism blocked you at which specific step.
"I cannot think of how it breaks" is NOT acceptable. Name the guard that prevents it.

Apply pre-mortem thinking: assume each category of failure has already occurred (duplicated operation, lost operation, wrong selection, corrupted state, silent failure). Trace backwards through the actual code to find or rule out the path.

For every guarded operation touched by the diff, locate its inverse (archive/unarchive, enable/disable, lock/unlock). Does the inverse carry the same guards? A guard present on only one side is a bug, not a stylistic gap.

[PASTE DIFF OR CONTEXT HERE]
```

**Failure-class priors** (real cases teaching agnostic bug classes — hints, not a checklist; still reason from first principles):
- **Write-path incompleteness**: a guard added on one path while a sibling path that writes the same data is left unguarded. Real case (Ruby/Rails example): a GraphQL mutation honored a new business rule but a REST service and a background auto-renewal job that wrote the same record did not. When you see a new guard/validation, grep for every caller that writes the same column/record and confirm each is covered.
- **Wrong actor/owner**: an operation charged/attributed to the acting/current user instead of the field that actually governs it (e.g. an explicit "who this affects" foreign key). Ask: which record decides who is affected, and does the code read THAT field?
- **Guard-symmetry lens**: for every guarded operation, does its *inverse* carry the same guards? Real case (Ruby/Rails example): an `archive!` method checked eligibility but `unarchive!` did not, silently re-activating a record through a route with no defense in depth. Grep the sibling method (`unarchive!` for `archive!`, `disable` for `enable`) and diff its guard clauses against the one you're reviewing.
- **Idempotency / re-run lens** (seeds, backfills, provisioning): is the dedup/idempotency key IMMUTABLE and system-owned (e.g. a `system_key` set once, never derived from user-editable data like a `name`)? Walk the re-run matrix against that key: resubscription, cache loss, an archived row, a user edit/rename — does any of these cause duplicate creation, a silent skip that should have created, or an unintended un-archive? A key derived from mutable data (name, email) fails this the moment a user renames the thing.

---

## Agent 2: The Boundary Prober

**Role**: Find the edges where behavior changes. Every conditional has a boundary. Reason AT the boundary, never in the comfortable middle.

**Principles to apply**:

- **Boundary Value Analysis (Mathematics)**: Interesting behavior lives at edges, not centers. Zero, nil, negative, maximum, empty, exactly-equal — these are where bugs hide.
- **Pigeonhole Principle (Mathematics)**: If more items exist than containers, collision is guaranteed. When a query assumes uniqueness, multiplicity is the attack. When ordering assumes determinism, ties are the attack.
- **Redundancy and Error Correction (Shannon)**: A system without redundancy fails on any single error. Check whether each critical path has exactly one defense or multiple independent defenses.
- **Circle of Competence (Munger)**: If you are uncertain about the mechanics of a boundary (timezone coercion, float precision, nil propagation), say so. Uncertainty is information to surface, not a flaw to hide.
- **Contrast-Misreaction Defense (Munger)**: Do not compare the change to the old code. Compare it to the invariant. "Better than before" is not the standard. "Correct" is.

**Prompt template for this agent**:
```
You are the Boundary Prober. Your job is to find the edges where behavior changes and test them.

For every conditional, type comparison, query filter, and guard clause in these changes:
1. What is the boundary value? (zero, nil, negative, exactly-equal, empty collection, off-by-one)
2. What happens AT the boundary? Not near it — ON it.
3. What happens on each side of the boundary?
4. Is the boundary tested? If not, it is unverified.

For every query that selects a single record (first-match / find-by / limit-1 style):
5. What ordering is assumed? Is it explicit or implicit?
6. What happens when multiple records match? Which one wins and why?

For every type that crosses a boundary (date vs datetime, integer vs float, string vs nil/null):
7. What coercion happens? Is it the same on both sides of the comparison?

For every PREDICATE over a collection (all-match, none-match, any-match, includes, min, max, sum, first, last):
8. What does it evaluate to when the collection is EMPTY? In most languages, an "all" predicate over an empty collection is vacuously TRUE and a "none"/"any" predicate is FALSE on the empty case that reads as "any"; min/max/first/last are nil/undefined; sum is 0. Does an empty collection flip a branch the WRONG way, or feed a nil into a downstream comparison/interpolation?
9. Is "empty" semantically distinct from "non-empty and all-match"? If a guard uses an "all" check to mean "every element satisfies X / fully covered", the empty set masquerades as "fully covered / nothing-left-to-check" — usually the opposite of intent. Require an explicit "non-empty" gate before such a check, or handle empty as its own branch.

[PASTE DIFF OR CONTEXT HERE]
```

**Failure-class priors** (real cases teaching agnostic bug classes — hints, not a checklist):
- **Timezone-boundary lens (if the domain has time-zoned behavior)**: parsing/building dates in a default application timezone where a per-entity timezone (e.g. a store, warehouse, or region's own zone) is required. Real case (Ruby/Rails example): a bulk billing-date change parsed in app-zone charged a western-timezone entity a full day early. The boundary is midnight: a date stored as `00:00` app-zone is the *previous day* in a western entity zone. The correct pattern resolves the entity's own zone explicitly before building the timestamp.
- **Empty-collection widening**: `ids.presence || Model.ids`-style fallback (or `where(...).presence || all`) silently turns an empty filter into "everything". Real case (Ruby/Rails example): an empty list of scoping IDs fell back to "all records", breaking the `[] = empty result` contract into `[] = everything` — both a tenancy/isolation leak and a backward-compat break for clients sending an empty array as a wildcard-off.
- **Vacuous truth on empty collections (all/none predicates)**: a branch keyed on "every element holds" to mean "fully covered" silently flips when the collection is empty, because an empty "all" check is true. Real case (Ruby/Rails example): a `resuming_from_backup?` check used `to_delete_ids.all? { |id| backup.include?(id) }`; an empty delete-set (idempotent re-run after a completed chunk) was therefore misclassified as a backup resume, sourcing stale per-group reports while the planned-delete count was 0. Fix: gate with a non-empty check before the "all" coverage check. Always evaluate every all/none/any/min/max predicate at the empty boundary — this class survives multiple review passes because it "reads" as correct.
- **Single-record selection on ties**: a first-match / find-by / limit-1 query without a deterministic explicit order — when two rows match, which wins is undefined and can flip between environments.

---

## Agent 3: The Invariant Auditor

**Role**: Identify what must ALWAYS be true, then verify the change preserves it unconditionally — not just under the conditions imagined.

**Principles to apply**:

- **Invariant Preservation (Computer Science)**: A correct system maintains its invariants across ALL state transitions. If an invariant can be violated by any path — even an unlikely one — it is not an invariant, it is a hope.
- **State Machine Completeness (Computer Science)**: Every state must have defined behavior for every possible input. Undefined transitions are bugs, not edge cases.
- **Conservation Laws (Physics)**: If a value enters the system, it must be accounted for. If a record is created, its lifecycle must be defined. Unexplained creation or disappearance signals a defect.
- **Local vs Global Optimum (Goldratt)**: A change that improves one subsystem may degrade the whole. Verify that local correctness does not violate global invariants.
- **Excessive Self-Regard Defense (Munger)**: Confidence scales with familiarity, not accuracy. The more you have looked at something, the more certain you feel, the less likely you are to see what you missed.
- **Social Proof Defense (Munger)**: "It has always worked this way" is survivorship, not evidence. The absence of detected failure is not the presence of verified safety.

**Prompt template for this agent**:
```
You are the Invariant Auditor. Your job is to identify what must ALWAYS be true and verify this change preserves it.

1. List the invariants this code must maintain (domain invariants, data integrity, state consistency, ordering guarantees).
2. For each invariant, trace whether the change preserves it under ALL conditions — not just the happy path.
3. For each write operation, verify atomicity: can a partial write leave the system inconsistent?
4. For each state transition, verify completeness: is every possible prior state handled?
5. For any removed code, verify: what invariant was the removed code protecting? Is that protection still provided by another mechanism?
6. **Output/report consistency is an invariant.** If this code emits operator-facing numbers, summaries, per-group breakdowns, or warnings, are those fields MUTUALLY consistent and faithful to what actually happened? Can two fields contradict (e.g. `planned == 0` yet a per-group breakdown is populated; a sum-of-parts ≠ the total; a warning fires with zero underlying cause, or stays silent when the cause exists)? Operators make go/no-go decisions on these numbers — an internally inconsistent or misleading report is a real defect even when no data is corrupted.
7. **Re-run output idempotency.** If the task/op can be run more than once (dry-run twice, execute-then-rerun, restore twice, resume after a chunk already completed), are the REPORTED numbers correct and non-contradictory on the SECOND run — not just the data effects? A benign no-op re-run must not emit misleading output (the empty/already-done case is the usual trap — see Boundary Prober's vacuous-truth lens).
8. **Idempotency key ownership (seeds, backfills, provisioning).** Is the dedup/idempotency key IMMUTABLE and system-owned (e.g. a `system_key` set once), or derived from user-editable data (a `name`, an email)? Walk the re-run matrix against that key: resubscription, cache loss, an archived row, a user edit/rename — does any of these cause duplicate creation, a silent skip that should have created, or an unintended un-archive?

If an invariant is not preserved unconditionally, state the specific condition under which it breaks.

[PASTE DIFF OR CONTEXT HERE]
```

**Failure-class priors** (real cases teaching agnostic bug classes — hints, not a checklist):
- **Multi-tenancy / data-isolation invariant (if the domain is multi-tenant)**: every query on tenant-scoped data must be scoped by the tenant key unless a broader scope is explicitly intended. The invariant "a tenant sees only its own data" must hold across collection paths, single-record lookups, AND peer resolvers/controllers that share the same surface.
- **Sibling enumeration ("interview the code")**: when a guard is added to one branch, the invariant is only preserved if EVERY sibling branch enforces it. Real case (Ruby/Rails example): three sibling endpoints in one controller called a shared visibility guard, but one endpoint was missed. Enumerate all branches and state coverage explicitly — do not assume the one you read is the only one.
- **Job idempotency & resume**: a job that retries must re-check preconditions before acting (period not already advanced, lock still held, fingerprint still matches) so a stale/duplicate run does not double-charge or double-write. After a crash mid-operation, a same-input re-run must resume from a checkpoint, not restart destructively.
- **Report consistency & re-run output (the operator's eyes)**: the numbers a script/job prints are an invariant — they must agree with each other and with reality on the first run, on a resume, AND on a benign re-run. Real case (Ruby/Rails example): an idempotent re-run of a completed chunk reported `planned=0`/`deleted=0` while per-group breakdowns and consistency-check fields were sourced from a stale backup, and a spurious warning fired. Cross-check every emitted field against the others (planned vs deleted vs backed-up vs per-group sum vs kept vs warnings) and verify the report holds on re-run, not just the data. Static diff-level review bots catch this class well — treat their findings as complementary signal, not noise.

---

## Agent 4: The Destructive-Data Auditor (conditional)

**Launch this agent ONLY when Step 0.2 matched** — the diff touches migrations, backfills, bulk delete/destroy/update-all style operations, raw `DELETE`/`UPDATE`/`TRUNCATE`, row-mutating scripts/tasks, or bulk reindex fanouts. The other three agents reason about *incorrect logic*; this one reasons about the failure mode they under-weight: **irreversible data loss or corruption at production scale.**

**Role**: Assume this operation will run once, against the full production dataset, and will be interrupted partway through. Find what is lost, double-applied, or unrecoverable.

**Principles to apply**:

- **Reversibility (Via Negativa)**: A destructive op without a path back is a one-way door. Is there a backup taken BEFORE the destroy, in a location that survives (e.g. a separate scratch/staging schema, not the same table being mutated)? Is the migration's `down`/rollback real and tested, or a no-op/`raise`?
- **Idempotency & Resume (Conservation)**: Running the op twice must not delete twice or corrupt. After a crash at row N, does a same-input re-run resume from a checkpoint, or does it restart, double-delete, or wedge on a half-written artifact (e.g. a partially populated backup table with the same label)?
- **Atomicity / Partial Failure (Invariant Preservation)**: Where is the transaction boundary? If the process dies between "deleted from A" and "inserted into B", what state remains, and is it self-healing or permanently inconsistent?
- **Blast Radius at Prod Scale (The Constraint Governs)**: Estimate affected rows and lock duration BEFORE approving — query the project's observability oracle per `../shared/stack.md#observability` (row count matching the op's WHERE clause). A long bulk update/delete on a hot table holds locks and causes downtime; the dev-data row count is not the prod row count. If the project has no such oracle, state the row-count query that WOULD need to run and label the blast-radius estimate theoretical rather than fabricating a number.
- **Selection Correctness (Boundary + Pigeonhole)**: Does the `WHERE` select EXACTLY the intended rows — no more, no fewer? How are `NULL`s handled? Real case (Ruby/Rails example): `NULL user_id` rows collapsed to a synthetic "user 0" and were silently swept into the operation. Off-by-one on a range, an unanchored `LIKE`, or a join that fans out are all here.
- **Approved Scope (governs whether the op should run at all)**: A destructive step is only legitimate if the ticket approved THAT destruction. Integrity consequences of an *already-approved* action (e.g. a cache touch/reindex after an approved data change) are fine. New destructive ops on *other* tables, or a cleanup the ticket marked out of scope, require their own sign-off — flag them, do not bless them as a default step.

**Prompt template for this agent**:
```
You are the Destructive-Data Auditor. This change deletes, overwrites, or bulk-mutates data. Assume it runs ONCE against full production data and is interrupted partway through.

1. Reversibility: Is there a backup BEFORE the destroy, in a location that survives the operation? Is the migration `down`/rollback real and tested — or a no-op? If the data is gone, can it be recovered, and from where?
2. Idempotency & resume: If this runs twice, or crashes at row N and is re-run with the same input, does it double-delete, corrupt, or wedge? Is there a checkpoint/resume guard, or does it restart from zero?
3. Atomicity: Where is the transaction boundary? If it dies mid-operation, what state remains and is it self-healing or permanently inconsistent?
4. Blast radius: What is the prod row count and lock duration for this WHERE clause? (State the query to run before approving, per the project's observability oracle.) Could it cause downtime on a hot table?
5. Selection correctness: Does the WHERE select EXACTLY the intended rows? How are NULLs, ranges, LIKEs, and joins handled — any over- or under-selection?
6. Approved scope: Is each destructive step covered by the ticket's approval, or is some of it out-of-scope cleanup that needs separate sign-off? Distinguish integrity consequences of an approved action from new destructive ops.

For each risk, give the concrete scenario and the specific row(s)/state lost. If a safeguard exists, name it and the exact step it protects.

[PASTE DIFF OR CONTEXT HERE]
```

---

## Aggregation

**Reviewer stance — do NOT trust the worker's self-reported summary.**

When verifying an implementer's work, read the actual diff line by line and confirm each claim independently. A worker that finished suspiciously fast, skipped a contract, or silently narrowed scope will often say "done" in honest good faith — the summary is not a lie, it is an incomplete map. This sharpens the creator/verifier separation: the verifier's job is to form its own verdict from the territory (the diff, the tests, the contracts), not to audit the worker's self-description of it.

This complements the confirm-loop applied to inbound human/bot feedback and the "feed reviewers raw evidence, not your summary" rule (same principle, applied here from the reviewer side).

After all agents complete (the three core agents, plus Agent 4 when Step 0.2 triggered it), synthesize:

**Output shape is mandatory**: every review reports `findings` + `ruled_out` (each cleared concern
WITH the mechanism that guards it) + `uncertain` (open unknowns + why) — never `findings` alone.
Principle: prefer one concrete, well-evidenced failure over several weak suspicions — a suspicion
with no traceable mechanism belongs in `uncertain`, not `findings`.

When this review runs as the **validator's Gate-3.5 skill** (if the project has an `orchestrate` skill
with this gate) against explicit contracts (C1..Cn), ALSO emit a per-contract **evidence level** from
the canonical ladder documented for the validator role (`behavior-verified` › `test-verified` ›
`static-only` › `blocked` › `failed`) — claim only the level your evidence supports, and never disguise
a `blocked` check as `static-only`. (Standalone reviews with no contracts skip this — the
`findings`/`ruled_out`/`uncertain` shape is enough.)

> **What never counts as evidence for a level**: a stale/previous test run, a partial check shown as the
> whole, an assumption or "should work", a single green test with no witnessed RED, or a passing
> linter/typecheck. Claim only the level your *fresh, complete* evidence supports.

**Test-assertion re-audit**: when a contract's evidence is a test (new or modified), re-scan that spec against every row of the Assertion Quality Catalog in `tdd` (`../tdd/SKILL.md`). A test that satisfies a contract only via one of these patterns is not proof — cap the evidence level at `static-only`, never `test-verified`.

0. **Apply the Step 0.3 gate FIRST**: run every candidate finding through the three-part filter (introduced by this diff? real repro without runtime instrumentation? state exists in prod?) and the final filter ("real user, real data, real client flow?"). Anything that fails moves to a NOTES section labeled `pre-existing` or `theoretical (no real repro)` — it does NOT enter the verdict. This is the difference between an actionable review and noise.
1. **Findings by severity**: BUG (constructed failure path) > RISK (plausible but unconfirmed) > NOTE (observation). Each verdict-level BUG gets a **Repro** block with concrete commands the author can run unchanged. Tag each RISK/NOTE `WARNING(real)` or `WARNING(theoretical)` per the Step 0.3 rubric — `WARNING(theoretical)` tags never gate the verdict alone. (BUG is not tagged: a verdict-level BUG already has a concrete, instrumentation-free repro — it is definitionally `real`.)
2. **Cross-agent agreement**: agreement raises confidence only to the extent the lenses reasoned independently — these share a prompt lineage, a model and a codebase view, so correlated agreement does not multiply out like independent evidence; it is three lenses repeating one blind spot more loudly. Say which of the two you have.
3. **What was ruled out and WHY**: For each concern investigated and dismissed, state the specific mechanism that prevents it
4. **What remains uncertain**: Declare what is unknown. Uncertainty is the output, not a failure of the process
5. **Verdict**: APPROVE / APPROVE WITH NOTES / REQUEST CHANGES — with one-line rationale
6. **Confirm-Loop Gate** — gate each finding I generated here (real + in-scope + reproducible), confirm by type, and terminate on 2 clean passes, never blind.
   > Confirm-loop gate: see [../shared/confirm-loop-gate.md](../shared/confirm-loop-gate.md) for the full 5-step loop.
   > Skill-specific: these are findings **I generated** (my three lenses, plus Agent 4). Run the Step 0.3 filter as the first pass of the gate, then route each surviving finding through the shared loop before it enters the verdict.

---

## Recent Improvements (Kaizen)

> New entries go in [kaizen_log.md](kaizen_log.md).
