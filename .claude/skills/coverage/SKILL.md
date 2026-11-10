---
name: coverage
description: Use after writing tests to verify 100% patch coverage across unit, integration, and system tests.
allowed-tools: [Bash, Read, Write, Edit, Grep, Glob, Agent]
disable-model-invocation: false
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

## Shared References

> **This skill uses shared documentation. See:**
> - [Forbidden Patterns](../shared/forbidden-patterns.md) - universal bans, incl. the 100%-coverage
>   spirit (no untested new code)
> - [Stack Adapter](../shared/stack.md) - coverage tooling and CI gates (`#coverage`), test
>   conventions/locations (`#test-conventions`), VCS base branch (`#vcs`)

# Coverage Improvement Skill

**CRITICAL: Both coverage checks must pass. No exceptions.**

Most CI coverage tools run **TWO separate checks** on every PR (see
[stack.md#coverage](../shared/stack.md) for this project's actual gate names/tool — Codecov's
`codecov/patch` + `codecov/project` split is a common example):

| Check | What it measures | Requirement |
|-------|------------------|-------------|
| Patch coverage | Coverage on **modified lines only** | All changed lines must be covered |
| Project coverage | **Global project coverage** | Must not decrease from base branch |

> **Common Failure**: a PR passes patch coverage but fails project coverage because adding new code
> without proportional tests reduces the global coverage percentage, even if every new line is
> covered.

## Patch Coverage Workflow (PRIORITY)

**ALWAYS follow this workflow when working on PRs:**

### Step 1: Diff Changed Lines

Identify changed source files (excluding test files). Scope per [Diff Scope](../shared/diff-scope.md),
variant `files` — coverage runs before the commit gate, and an untracked brand-new source file is
both uncovered by definition and invisible to every `git diff`:

```bash
BASE="$(git merge-base <base-branch> HEAD)"   # <base-branch> per stack.md#vcs
: "${BASE:?no merge base — see Diff Scope; deepen a shallow clone and retry}"
{
  git diff --name-only "$BASE"
  git diff --cached --name-only "$BASE"
  git ls-files --others --exclude-standard
} | sort -u | grep -v '<test-dir-pattern>'
```

All three queries plus the `sort -u`, per the fragment. Dropping the `--cached` line hides a
staged-only source file, which then reports clean patch coverage; dropping the `sort -u` lets the
overlapping first two queries double-count a path in the denominator. The guard is what stops the
worst failure of all: with no merge base `BASE` is empty, every query prints nothing, and Step 1
concludes "no changed source files" — after which Steps 2-5 verify 100% patch coverage over zero
lines and report success.

Then get the changed line numbers per file (variant `lines`):

```bash
BASE="$(git merge-base <base-branch> HEAD)"   # <base-branch> per stack.md#vcs
: "${BASE:?no merge base — see Diff Scope; deepen a shallow clone and retry}"
git diff --unified=0 "$BASE" -- <file> | grep "^@@"
git diff --cached --unified=0 "$BASE" -- <file> | grep "^@@"
# Parse the @@ -a,b +c,d @@ hunks to a list of changed line numbers in the new file.
# An untracked file has no hunk header: every one of its lines is a changed line. Manufacture one
# with `git diff --no-index --unified=0 /dev/null <file>`, which exits 1 by design.
```

### Step 2: Run Coverage

Run the changed file's tests with coverage instrumentation enabled — see
[stack.md#coverage](../shared/stack.md) for the command. That section must produce **per-line hit
data for the changed files** (which lines executed, which didn't).

```bash
<coverage-instrumented test command from stack.md#coverage> <path/to/test>
```

### Step 3: Cross-Reference Uncovered Lines

Compare the changed line numbers (Step 1) against the uncovered lines from the coverage report
(Step 2). **ALL changed lines must be covered before committing.**

**Verification Checklist:**
- [ ] All added lines are covered
- [ ] All modified lines are covered
- [ ] Edge cases and error paths are tested
- [ ] No new code without corresponding tests

### Step 4: Write Tests for Uncovered Lines

If changed lines are uncovered:
1. Identify the uncovered line numbers from the coverage report
2. Cross-reference with the `git diff` output from Step 1
3. Write tests that execute those specific lines
4. **DO NOT commit until ALL changed lines are covered**

Write tests from a **correctness validation perspective** — tests should reflect expected behavior,
not just replicate the code path. Use this pass to also surface potential bugs, edge cases, and
ambiguous behavior. Follow this project's test conventions
([stack.md#test-conventions](../shared/stack.md)) for fixture/setup patterns, time handling, and
any shared-state cleanup (cache/queue) the tests need.

### Step 5: Verify

Re-run coverage (Step 2's command) and confirm every changed line now shows as covered. Also
consult [stack.md#coverage](../shared/stack.md) for any project-specific coverage-progress or
uncovered-file commands (e.g. "find lowest-covered files," "check coverage delta vs baseline") and
run them if this workflow is part of a larger PR-readiness pass.

## Optimize Tests After Writing (Tier 1 — ALWAYS)

> See [code-simplifier agent](../../agents/code-simplifier.md) for the dispatch tiers and the
> semantically-equivalent-only contract.

**After writing new/updated tests for coverage, always run one optimization pass** using the
`code-simplifier` agent (or a matching project agent/skill if `code-simplifier` isn't available;
else do this manually):

```
Agent tool with subagent_type: "code-simplifier"
prompt: "Review and optimize this test file for performance and clarity:
  - Prefer lazy/lightweight object construction over full persistence when the test doesn't need it
  - Remove redundant test setup
  - Consolidate similar contexts/describe blocks
  - Remove unnecessary I/O or database operations
  File: <path/to/test_file>"
```

This is a Tier-1 (always-run, no user approval needed) integration: it runs automatically right
after new test code is generated, same as it does at the end of the `tdd` skill's Refactor step.

**Then re-verify** with the commands from Step 2/5 above — an optimization pass must not regress
coverage **or turn a passing test red**. Re-run them yourself; never accept the agent's returned
self-report in place of the run (`.claude/agents/validator.md` anti-gaming rules).

## Test Locations

Unit / integration / system test directories and per-kind commands are project-specific — see
[stack.md#test-conventions](../shared/stack.md). If TODO, ask the user and record the answer there
before finishing.

## Forbidden Patterns

> See [Forbidden Patterns](../shared/forbidden-patterns.md) for the complete universal list
> (mocking the subject under test, sleep-based waits, hardcoded IDs, session artifacts, swallowed
> errors) plus [stack.md#forbidden-patterns](../shared/stack.md) for anything stack-specific.

Coverage-adjacent rule: **100% coverage on changed lines is non-negotiable.** A test suite that
passes without exercising every changed line is not done.

## Common Patch Coverage Pitfalls

| Issue | Example | Solution |
|-------|---------|----------|
| Refactoring without tests | Moving logic into a new method/class without a new test | Test the new structure directly |
| Callback/hook side effects | A lifecycle callback triggers a notification/side effect | Test that the transition/event triggers the side effect |
| Format-only changes | Indentation, line breaks | These count as changed lines - may need tests if logic moved |
| Complex conditionals | Multiple `elsif`/`else if`/`switch` branches | Test each branch explicitly |
| Error handling paths | `rescue`/`catch`/`except` blocks | Test error scenarios |
| New method/function calls | A new helper is introduced and called | Test that the new helper is actually exercised |
| Class/static methods | `def self.foo` / `static foo()` | Call it the same way production code does, not just directly |

---

## Appendix: Project Coverage Workflow (When the Project-Coverage Check Fails)

**Why project coverage fails**: adding ANY new lines of code without adding MORE covered test lines
reduces the overall coverage percentage. Even with 100% patch coverage, the global % can still drop.

### Understanding the Math

```
Before PR:  80,000 covered lines / 100,000 total lines = 80.00% coverage
After PR:   80,100 covered lines / 100,200 total lines = 79.92% coverage (FAIL: -0.08%)
```

Even though you covered all 100 new lines (100% patch), you only added 100 test hits. The project
now has 200 more lines but only 100 more covered hits → the percentage drops.

### Step 1: Check Current Project Coverage Impact

Run the full suite with coverage instrumentation ([stack.md#coverage](../shared/stack.md)) and note
the total coverage percentage.

To compare against the base-branch baseline **without leaving your feature branch** — do not
`git checkout`/`git stash` onto the base branch to measure it; that mutates your working tree and
risks operating on a protected branch. Instead, use an isolated worktree checked out from the base
branch (see the project's worktree-workflow skill if present, else `git worktree add --detach
<path> origin/<base-branch>`, run coverage there, then `git worktree remove <path>`), or — simpler
for most cases — skip the baseline comparison entirely and rely on the patch-coverage check alone
(it's typically the primary/mandatory gate; project-coverage delta is usually a secondary signal).

### Step 2: Calculate Required Compensating Coverage

To maintain or increase project coverage when adding N new lines:

```
Required additional covered lines = N × (1 / current_coverage_ratio)

Example: Adding 200 new lines at 80% base coverage:
Required = 200 × (1 / 0.80) = 250 covered lines needed
You need 50 MORE test hits beyond just covering your new code
```

### Step 3: Find Low-Coverage Files to Improve

Use [stack.md#coverage](../shared/stack.md)'s "find lowest-covered files" command (if one exists).
Focus on files with:
- High line count but low coverage (more impact per test)
- Simple logic (quick to test)
- Related to your changes (natural to include in the same PR)

### Step 4: Add Compensating Tests

**Strategy 1: Improve related files** — if your PR touches one module, also improve coverage on its
close collaborators/siblings in the same domain.

**Strategy 2: Low-hanging fruit** — target files with many uncovered lines but simple logic.

**Strategy 3: Add edge-case tests** — look for uncovered branches in your modified files: error
handling (`rescue`/`catch` blocks), conditional branches (`elsif`/`else`), guard clauses
(`return if`/early-return).

### Step 5: Verify Project Coverage Impact

Re-run the full suite with coverage instrumentation. The total percentage should be >= the base
branch's baseline.

### Project Coverage Checklist

Before pushing the PR:
- [ ] Patch coverage will pass (all changed lines covered)
- [ ] Project coverage will pass (global % not decreased)
- [ ] If adding many new lines, added compensating tests
- [ ] Verified with a full suite run, not just the affected tests

---

## Kaizen: Continuous Improvement

> "Every day we must improve" - 改善

**While executing this skill**, if you discover a new pattern, a missing pitfall, an outdated
command, or a better way to close a coverage gap, you MUST:
1. Complete the current task first
2. Use the Edit tool to append the improvement to `kaizen_log.md`
   (format: `<!-- Kaizen: YYYY-MM-DD --> Improvement`)

Changelog lives in [`kaizen_log.md`](kaizen_log.md) (bundled), not inline here.
