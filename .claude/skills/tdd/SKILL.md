---
name: tdd
description: MANDATORY for behavioral code changes — triggers when implementing a feature, fixing a bug, modifying existing behavior, or adding a guard. Does NOT fire on pure reads, docs, or config-only changes — except a deliverable containing commands someone else will run, which always fires regardless of file type (see ../shared/executable-handoff-gate.md).
allowed-tools: [Bash, Read, Write, Edit, Grep, Glob, Agent, mcp__context7__resolve-library-id, mcp__context7__query-docs]
disable-model-invocation: false
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# TDD Workflow - MANDATORY

## Shared References

> **This skill uses shared documentation. See:**
> - [Forbidden Patterns](../shared/forbidden-patterns.md) - universal bans (mocking the subject,
>   sleep-based waits, session artifacts, hardcoded IDs, swallowed errors)
> - [Stack Adapter](../shared/stack.md) - this project's test commands (`#commands`), test
>   conventions/templates/framework (`#test-conventions`), coverage tooling (`#coverage`), VCS base
>   branch (`#vcs`)
> - [Assertion Quality — Worked Examples](reference/assertion-quality.md) - full detail for the
>   catalog below (origin examples are Ruby/RSpec; the principles are stack-agnostic)
> - [Executable Handoff Gate](../shared/executable-handoff-gate.md) - the canonical gate for a
>   hand-off executable (trigger, norm, procedure, disclosure), shared with `validator.md`,
>   `worker.md`, and `/architect`
> - [Diff Scope](../shared/diff-scope.md) - the canonical "what changed" scope for a gate running
>   BEFORE the commit (merge base → working tree, plus untracked files) and its three variants
> - [Return Status](../shared/return-status.md) - the four values a hand-off reports (`DONE` /
>   `DONE_WITH_CONCERNS` / `BLOCKED` / `NEEDS_CONTEXT`) and the one test that separates `BLOCKED`
>   from `NEEDS_CONTEXT`

## CRITICAL RULE

**NEVER write implementation code before tests exist.**

This is non-negotiable. Every code change MUST follow the TDD cycle:

### If Code Was Written Before Tests: Delete and Restart

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? **Delete it. Start over.**

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

**Protocol when untested code already exists:**
1. Stash or delete the untested code (`git stash` or delete the file/method)
2. Write the failing test first (RED)
3. Reimplement from scratch driven by the test (GREEN)
4. The earlier code may inform the design — but never bypass the RED step

Implement fresh from tests. Period.

```
┌─────────────────────────────────────────────────────────┐
│  1. RED:      Write failing test FIRST                  │
│               ↓                                         │
│  2. GREEN:   Write MINIMAL code to pass                 │
│               ↓                                         │
│  3. REFACTOR: Improve while keeping tests green         │
│               ↓                                         │
│  4. COVERAGE: Verify 100% on changes                     │
│               ↓                                         │
│  (repeat for each behavior)                              │
└─────────────────────────────────────────────────────────┘
```

## Running Tests

All commands run through the project exec wrapper — see [stack.md#commands](../shared/stack.md)
for the actual invocation. That section must answer: how to run a single test file, and how to run
the full suite (and whether a parallel mode is preferred).

```bash
<single-test-file command from stack.md#commands>
<full-suite command from stack.md#commands>   # PREFERRED if a parallel/fast mode exists
```

## Workflow

### Step 1: Understand the Requirement

Before writing anything:
1. Identify the expected behavior
2. Define inputs and outputs
3. List edge cases and error conditions

**HTTP-facing classification (mandatory):** Ask — "Is this code reached via HTTP?" (API
handler/resolver / controller / middleware / webhook / endpoint-triggered job). If **yes**, the RED
test in Step 2 MUST exercise the real entry point — not a unit test that stubs the framework or
calls private methods on a bypassed/uninitialized object. See
[stack.md#test-conventions](../shared/stack.md) for this project's HTTP-facing integration test
template; if none exists yet, write the minimal idiomatic equivalent and record it there.

**Hand-off classification (mandatory):** Ask — "will a human, or a live environment, execute this artifact as-is?" (a console/ops command sequence, a one-off data-fix or backfill invocation, a
phased runbook, a migration/rollback command block). If **yes**, this is a hand-off executable —
the [Executable Handoff Gate](../shared/executable-handoff-gate.md) applies, and the artifact's own
local execution (every phase, including preview/dry-run and rollback) IS this task's RED step.

### Before Writing Tests: Consult Best Practices

**Check `../shared/best-practices.md` first, when present** (created by `/stack-sync`) for the
test framework's recorded practices — a version-pinned, evidence-backed baseline — before doing a
live docs lookup. If its section stamp is >90 days old or the recorded version has drifted from
the lockfile, note it and suggest a `/stack-sync` refresh; do not block on it.

**ALWAYS consult current documentation for the project's test framework** before writing tests
(per [stack.md#test-conventions](../shared/stack.md)). If a docs-lookup tool is available (e.g.
`mcp__context7__resolve-library-id` / `mcp__context7__query-docs`), resolve the library ID for the
test framework named in stack.md, then query for patterns relevant to your test. Useful query
shapes:

- Fixture/setup performance: `"<framework> lazy vs eager object construction"`
- Mocking patterns: `"<framework> mocking best practices"`
- Async testing: `"testing background jobs/queues efficiently"`
- API-layer testing: `"<API framework> testing patterns"`

### Step 2: Write the Test (RED)

Use the unit/integration/RED template appropriate for this stack — see
[stack.md#test-conventions](../shared/stack.md) for template locations. If none exist yet, write
the minimal idiomatic test for the language/framework in use and record the pattern in stack.md so
the next run doesn't have to rediscover it.

**Write only enough of the test to fail.** You must not write more of a test than is sufficient to
fail, or fail to compile. Stop at the first failing assertion and go make it pass; the next
assertion belongs to the next cycle. A failure to compile or load is where you stop *writing* — it is
not yet the witnessed RED below: once the test loads, rerun it and confirm the failure names the
missing behavior.

Run the test — it MUST fail. **Do not assume it fails. Run it and READ the full output.**
```bash
<test command from stack.md#commands> <path/to/test>
# Expected: RED — confirm the failure message says the FEATURE IS MISSING,
# not a load error, typo, or misconfigured fixture. A load error is not a RED test.
```

#### Assertion-Depth gate (anti coverage-theater)

For every assertion ask: "Does this prove the BEHAVIOR or just that the code ran?"

| Weak (coverage-theater) | Strong (behavioral) |
|-------------------------|---------------------|
| `expect(record.destroy).to be_truthy` | `expect { record.destroy }.to change(Model, :count).by(-1)` |
| Verifies call happened | Verifies side-effect: `expect(record.reload).to be_destroyed` |

*(Ruby/RSpec example syntax above — adapt to your test framework's assertion style; the principle
is stack-agnostic.)*

**100% line coverage ≠ behavioral coverage.** Lines executed without assertions about their output
are untested. (The "sole assertion is `not_to raise_error`" case is banned outright — see "Empty
smoke test" in the catalog below.)

#### Assertion Quality Catalog (banned patterns)

Some assertions pass in green while proving nothing — ban these outright:

| Anti-pattern | Example (Ruby/RSpec) | Fix |
|---|---|---|
| Tautology | `expect(true).to be true`, asserting on the fixture you just built | Assert the unit's OUTPUT, not its own setup |
| **Ghost loop** | `memberships.each { \|m\| expect(m.status).to eq('active') }` where `memberships` may be `[]` | Assert `expect(memberships).not_to be_empty` (or the exact count) BEFORE iterating — on an empty collection every loop-body assertion silently never runs |
| Orphan empty-collection assertion | `expect(result).to eq([])` as the ONLY check on a path meant to produce data | Seed data so the path is actually exercised; assert on the populated case |
| Implementation-detail coupling | Asserting a CSS class, private-method call order, or internal call sequence instead of observable behavior | Assert rendered content / HTTP status / persisted state — what a caller can observe, not how it got there |
| Empty smoke test | `expect { subject }.not_to raise_error` as the SOLE assertion | Pair with a real behavioral assertion, or delete — "didn't crash" is not a spec |
| **Asserted name, unasserted value** | Checking that an option or flag appears in a produced invocation without checking the value it carries — so a value meant to stay empty that silently becomes non-empty leaves the suite green | Assert the option together with its exact value (or its exact emptiness), so a changed value turns the test red |
| **Defeasible negative assertion** | Asserting a term is absent from an output by exact match — an addition elsewhere in the same output (a new wrapper, quoting, a reordered neighbor) makes the match miss while the watched term stays in place | Pair every absence check with a presence check proving the watched region was produced, and aim the absence check at that region in a form the addition cannot dodge |

Full worked examples: [reference/assertion-quality.md](reference/assertion-quality.md).

**Mock/assertion ratio** (per example): ≤3 mocks = healthy · 4-6 = extract the logic under test into
a pure function/object and test THAT without mocks · 7+ = you're testing at the wrong layer (see the
project's code-review process — matching project skill if present, else manual).

**Extract-before-mock rule**: before adding a 4th mock to one example, stop and extract the
exercised logic into a dependency-free unit; test the extraction directly instead of mocking around
it.

#### Common Rationalizations — Intercept Before Skipping the Test

Thinking about skipping the RED step? Full excuse-vs-reality table + Red Flags list:
[reference/rationalization-catalog.md](reference/rationalization-catalog.md).

#### Regression & guard proof ritual (mutate, watch it fail, revert)

For any test that claims to guard a behavior — a bug fix, a new feature, or any guard/negative-path
test (escaping, isolation scope, input parsing, caps/limits, authorization) — passing once is not
enough; you must prove the test actually catches the behavior going away:

```
1. Write the test
2. Run with the behavior in place → must PASS (GREEN)
3. MUTATE the code under test: revert the fix, or break/delete the behavior or guard the test protects
4. Run again → test MUST now FAIL (RED)
5. Restore via the VCS's single-file restore, never a stash that also hides unrelated work
6. Run again → PASS (GREEN)
```

A test that was never observed to fail with the behavior removed is not proven to guard
anything — it may be vacuously passing (wrong assertion, wrong code path, coincidental data). Fix
the fixture, don't skip the ritual: decoys must match only *without* the guard; cross-isolation
fixtures use a distinct owner at every level; match/search fixtures pin literal values instead of
random-data generators that can collide. This is especially critical for high-stakes fixes
(payments, financial/membership state — a Ruby/Rails example domain, but the ritual applies to any
critical-state fix), where a vacuously-green test gives false confidence while leaving the bug or
gap live. Record each mutation result in the return / PR Evidence.

### Step 3: Implement Minimal Code (GREEN)

Write ONLY enough code to make the test pass:
- No optimization
- No extra features
- No "nice to have" code

```bash
<test command from stack.md#commands> <path/to/test>
# Expected: GREEN (all pass)
```

### Step 4: Refactor

Improve the code while keeping tests green:
- Remove duplication
- Improve naming
- Optimize if needed

```bash
<test command from stack.md#commands> <path/to/test>
# Must stay GREEN after each change
```

After refactoring tests, clean up test-setup patterns per
[stack.md#test-conventions](../shared/stack.md) (e.g. lazy vs eager object construction, fixture
reuse) — matching project skill if present (e.g. a factory-check equivalent), else manual.

### Step 4.5: Lint Changed Files (BEFORE git add)

**CRITICAL**: Run the lint command BEFORE staging files to catch issues early — see
[stack.md#commands](../shared/stack.md) for the project's lint invocation. Most linters only
analyze unstaged/working-tree files meaningfully when run before `git add`; check whether that
applies here.

```bash
<lint command from stack.md#commands>
```

**Expected output**: No violations (empty output, or the tool's clean-pass signal). Fix all
violations, re-run until clean.

### Step 5: Verify Coverage (MANDATORY)

100% coverage on changed lines is required. See the `coverage` skill (matching project skill if
present, else manual) for the full walkthrough, and [stack.md#coverage](../shared/stack.md) for the
commands.

**Evidence gate before declaring done:**

1. **VCS diff check** — confirm the claimed changes are actually present: `git diff --name-only
   HEAD` for tracked changes, AND `git ls-files --others --exclude-standard` for files you created,
   which no `git diff` in any form will list (see [Diff Scope](../shared/diff-scope.md)). Do not
   declare a file changed if it appears in neither.
   **`HEAD`, not the merge base, is deliberate here — do not "fix" it to the pre-commit form.** The
   question this check asks is "did my edit land on disk", not "what does this branch change". Two
   kinds of landed change come back as *not* landed anyway. An edit staged and then reverted on
   disk: `git diff HEAD` compares HEAD to the working tree and ignores the index entirely. And an
   edit already committed on this branch: it is in neither `git diff HEAD` nor `git ls-files
   --others`, which is routine wherever work is committed as it goes rather than in one final
   commit. Both are the wrong answer in the safe direction — they cost a redundant re-edit, whereas
   the merge-base form's wrong answer would be a false "clean" that ships.
2. **Contract reconciliation** — go through the validation contracts (C1..Cn) one by one and
   confirm each has a passing test. Don't assume — trace each contract to its test. The
   contract→test mapping goes in your RETURN and the orchestration-log — NEVER in test names or
   code comments (see [Forbidden Patterns — Session artifacts in committed
   code](../shared/forbidden-patterns.md)).

**No completion claim without fresh verification evidence.** You cannot use success/satisfaction
wording unless the verifying command was actually run in this message — a command someone else can
run again for the same verdict, per
[P6, repeatable proof](../shared/principles.md#p6--repeatable-proof):

| Claim | Required evidence | NOT sufficient |
|-------|-------------------|----------------|
| "Tests pass" | test-runner output showing 0 failures (stack.md#commands) | "Should pass", previous run, code looks right |
| "Coverage met" | coverage-delta output (stack.md#coverage) | "I covered all branches" |
| "Agent/worker completed" | VCS diff shows the changes | Worker's self-report of success |
| "Linter clean" | lint output (empty = clean, stack.md#commands) | "I fixed all the violations" |
| "Bug is fixed" | Test exercising original symptom passes | Code changed, assumed fixed |
| "Hand-off deliverable is done" | Its actual execution output from this session, every phase including preview/dry-run and rollback (../shared/executable-handoff-gate.md) | It reads correctly, a symbol/name check alone, a previous run |
| "Regression test guards the bug" | Red-green cycle verified (see regression proof above) | Test was written and passes once |

Red flags — STOP before claiming done:
- Using "should", "probably", "seems to"
- Expressing satisfaction ("Done!", "Perfect!", "Should work") before running the command
- Trusting a subagent/worker's success report without checking the diff

## Anti-Patterns

### Anti-over-mocking

Mock only DEPENDENCIES, never the unit under test. If you're stubbing a method on the class/object
under test or its own instance, that is a smell — inject the dependency or test at integration
level.

This is sharper than the "no mocking any instance of a collaborator class" ban (see [Forbidden
Patterns — Mocking the subject under test](../shared/forbidden-patterns.md)): even a broad
any-instance mock on a collaborator is wrong; stubbing the subject itself is doubly wrong.

### Flaky-Test Triage

RED is not proven if the test is flaky. Quick decision tree:

**Hard rule — wait on a condition, never on a clock.** No arbitrary `sleep` or fixed timeout in ANY
test (unit, request, or system). Poll the real condition instead (explicit wait-for-condition
helper, not a fixed delay). See [Forbidden Patterns — Sleep-based waits in
tests](../shared/forbidden-patterns.md) — arbitrary sleeps are the #1 source of flaky, slow suites.

Triage by symptom — each of these must have an answer in
[stack.md#test-conventions](../shared/stack.md); if TODO, ask the user and record the answer there:

- Passes repeatedly alone but fails under parallel/concurrent execution? → what causes shared state
  to leak across tests in this stack (setup scope, unique-value generation)?
- Time-of-day / date-boundary failures? → what is this stack's time-freezing mechanism?
- Cache/queue/external-state leaking between tests? → what must be cleared in setup/teardown?
- Order-dependent failures? → does the test runner support seed-based bisection, and what's the
  invocation?
- Slowest examples / profiling? → what's the test runner's profiling flag?
- CI flake quarantine/retry? → is a retry mechanism installed, and is it enabled by default or does
  it require explicit configuration?
- Fixture/setup overhead slowing tests? → is there a setup-cost profiler for this framework?

### Parallel-safety (isolation)

New/changed tests MUST be parallel-safe if the project runs tests in parallel (check
[stack.md#test-conventions](../shared/stack.md)). Concretely, that section should answer: does test
rebalancing co-locate unrelated files in shared workers (meaning a leaked global fails an UNRELATED
test)? What global/shared state needs explicit isolation per test (time freeze, current-request
context, singletons)? Is `before(:all)`-equivalent setup (shared across examples, not
per-example) safe here, or does it leak records/state across files? Are fixtures transactional by
default?

### Characterization Tests for Untested Legacy

When the delete-and-reimplement protocol is too risky (state-machine or otherwise critical code
with >~200 lines and no tests), write tests that CAPTURE current behavior first (not asserting it's
correct), then refactor green, then correct. Run a code-smell/architecture-review pass (matching
project skill if present, else manual) before attempting a large legacy refactor.

### Semantic stability

The rule is tool-free: when the meaning of the code changes, some test must fail. It is stated once,
in `../shared/principles.md#p2--semantic-stability-a-test-is-proven-only-by-a-witnessed-failure`;
this section is how this skill applies it.

Coverage cannot show it — delete every assertion from a suite and its coverage does not move. The
check that can is the mutate → RED → revert ritual in Step 2, applied to each behavior a new test
claims to guard. It is required on every behavioral change, whether or not the stack has tooling for
it.

A mutation-testing tool, where [stack.md#semantic-stability](../shared/stack.md) names one, runs the same
check across many mutants at once. It is an accelerator, not a prerequisite: its absence never
excuses the ritual, and adopting one is a stack decision recorded in stack.md, not a precondition
for this skill.

### Mutation Testing (tooling, optional)

Guard mutation per the Regression & guard proof ritual above (Step 2) is mandatory regardless of
tooling.

A mutation-testing tool (e.g. `mutant`, Stryker, PIT) may or may not be wired into this stack —
check [stack.md#semantic-stability](../shared/stack.md). Mutation testing would prove tests catch bugs beyond
coverage %, but adding a new tool is out of scope for this skill and needs a separate sign-off. Do
NOT treat tool-based mutation testing as mandatory while the tool is absent from the stack.

## Test Types

Unit, Integration, and System/E2E test locations and boundaries are project-specific — see
[stack.md#test-conventions](../shared/stack.md) for this project's directory layout and per-kind
templates. If TODO, ask the user and record the answer there before finishing.

## System / E2E Tests

See [stack.md#test-conventions](../shared/stack.md) for this project's system-test framework,
setup/version-pinning, run command, and failure-debugging conventions (e.g. auto-screenshots,
headed-mode flag). If TODO, ask the user and record the answer there.

For a behavioral change in a component that has no unit-test harness, the system/E2E test IS the
RED step — write it first, before touching the component.

## Remember

> "If you can't write a test for it, you don't understand the requirement well enough."

**Tests are not optional. Tests come FIRST. Always.**

| Checklist | Status |
|-----------|--------|
| Test written BEFORE implementation | Required |
| 100% coverage on changed lines | Required |
| No forbidden patterns | Required |
| Test setup follows stack.md#test-conventions (lazy construction, no over-fetching) | Required |
| Time-dependent tests use stack.md#test-conventions' time-freezing pattern | Required |
| System/E2E tests use unique/randomized test data per stack.md#test-conventions | Required |

### Self-review before handoff (early filter — NOT a replacement for the validator gate)

Before reporting DONE, run a quick self-review across the following axes and fix what you find:

1. **Completeness** — does the diff satisfy every validation contract (C1..Cn)? If a contract is
   unaddressed, fix it or report `NEEDS_CONTEXT` ([Return Status](../shared/return-status.md)).
2. **Quality** — are tests asserting real behavior (not mocking the thing under test)? Are they
   readable?
3. **Discipline (YAGNI)** — did you add anything beyond what the contracts require? Remove it.
4. **Testing** — run the full test file one more time; confirm it's green with no pending/skipped
   examples you didn't intend.
5. **Escalation** — is there something genuinely unresolvable (missing context, ambiguous contract,
   external dependency)? Report it now rather than guessing:
   [Return Status](../shared/return-status.md) separates `BLOCKED` from `NEEDS_CONTEXT`.
6. **Process-artifact leak** — grep changed test files (glob per
   [stack.md#test-conventions](../shared/stack.md)) for contract/ticket IDs before handoff:
   ```bash
   BASE="$(git merge-base <base-branch> HEAD)"   # <base-branch> per stack.md#vcs
   : "${BASE:?no merge base — see Diff Scope; deepen a shallow clone and retry}"
   git diff "$BASE" -- <test-file-glob> | grep -nE '(BF-?C\d|[^A-Za-z]C\d+[^A-Za-z]|[A-Z]{2,}-\d+)'
   git diff --cached "$BASE" -- <test-file-glob> | grep -nE '(BF-?C\d|[^A-Za-z]C\d+[^A-Za-z]|[A-Z]{2,}-\d+)'
   git ls-files --others --exclude-standard -- <test-file-glob> \
     | while read -r f; do grep -nHE '(BF-?C\d|[^A-Za-z]C\d+[^A-Za-z]|[A-Z]{2,}-\d+)' "$f"; done
   ```
   (All three lines come from [Diff Scope](../shared/diff-scope.md), variant `content`. A test file
   you just created is untracked: no `git diff` will ever show it, and it is the likeliest place for
   a contract ID to survive. A file you already staged is invisible to the plain `git diff` too —
   hence the `--cached` line.)
   Any hit = a session artifact leaked into a test (see [Forbidden Patterns — Session artifacts in
   committed code](../shared/forbidden-patterns.md)). Rename the block to behavior language and
   re-run before reporting DONE.
7. **Comments** — apply [Comment Discipline](../shared/comment-discipline.md) to this diff now, not
   at the review gate.
8. **Router-matched domain skills** — enumerate which conventions your changed files invoke and
   confirm each was followed (or run it now):
   ```bash
   BASE="$(git merge-base <base-branch> HEAD)"   # <base-branch> per stack.md#vcs
   : "${BASE:?no merge base — see Diff Scope; deepen a shallow clone and retry}"
   {
     git diff --name-only "$BASE"
     git diff --cached --name-only "$BASE"
     git ls-files --others --exclude-standard
   } | sort -u
   ```
   (Every line plus the `sort -u`, per [Diff Scope](../shared/diff-scope.md) variant `files` — a NEW
   file is the one most likely to match a router glob nobody consulted, no `git diff` will show it
   to you, and the first two queries overlap on every path already committed on this branch.)
   For each path, find the matching row(s) in the **Skill Router** in `CLAUDE.md` (by glob/area —
   e.g. data-layer changes → data-isolation/performance conventions; time/date writes →
   timezone-safety conventions; background-job changes → job-reliability conventions; external HTTP
   calls → resilience conventions) and confirm you followed that skill during the build, or run it
   now. Report in your RETURN which skills matched and their status. This turns "consult the
   router" from a soft reminder into a checked step, so the validator/code-review gate finds
   nothing mechanical left to flag.

**Report the status verbatim.** A cycle that satisfied every contract but left a concern is
`DONE_WITH_CONCERNS`, not `DONE` — see [Return Status](../shared/return-status.md).

Report what you fixed and what (if anything) you escalated. This is the worker's last pass before
the independent validator gate.

---

## Kaizen: Continuous Improvement

> "Every day we must improve" - 改善

**While executing this skill**, if you discover:
- A new pattern that should be documented
- A missing edge case or forbidden pattern
- An outdated example or command
- A better way to accomplish something

**You MUST**:
1. Complete the current task first
2. Use the Edit tool to append the improvement to `kaizen_log.md`
   (format: `<!-- Kaizen: YYYY-MM-DD --> Improvement`)

Changelog lives in [`kaizen_log.md`](kaizen_log.md) (bundled), not inline here.
