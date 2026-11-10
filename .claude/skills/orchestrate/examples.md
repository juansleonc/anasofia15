# Orchestrate — Worked Examples

Relocated from SKILL.md body (progressive disclosure). Two worked examples:
1. **Status Tracking** — the per-phase dispatch/return report format.
2. **Example Session** — an end-to-end `/orchestrate feature` walkthrough.

---

## Status Tracking

The coordinator reports what it **dispatched** and what each subagent **returned** (it does none of the work itself). Add a "Dispatched to" column:

```markdown
## Orchestration Status: Feature X

### Phase 0a: Grill (coordinator-direct)
Contracts emitted: C1 (no duplicate delivery), C2 (tenant-scoped), C3 (idempotent retry)

### Phase 1: Analysis
| Skill | Dispatched to | Status | Result |
|-------|---------------|--------|--------|
| router-matched analyst 1 | Agent(Explore) | ✅ | No violations |
| router-matched analyst 2 | Agent(Explore) | ✅ | Boundaries OK |
| router-matched analyst 3 | Agent(Explore) | ✅ | No issues |

### Gate 2.5: Decompose (non-trivial only)
| Artifact | Emitted by | Status | Result |
|----------|------------|--------|--------|
| tasks.md | Agent(architect) | ✅ | 4 tasks, each 1 RED→GREEN, mapped C1×2 / C2 / C3 |

### Phase 2: Implementation
| Skill | Dispatched to | Status | Result |
|-------|---------------|--------|--------|
| tdd | Agent(worker) | ✅ | walked tasks.md (4/4 checked); 12 examples green; C1–C3 satisfied |

### Gate 3.5: Validator (independent)
| Skill | Dispatched to | Status | Result |
|-------|---------------|--------|--------|
| adversarial-review | Agent(validator) | ✅ | C1 test-verified, C2 test-verified, C3 behavior-verified → APPROVE |

### Phase 3: Quality
| Skill | Dispatched to | Status | Result |
|-------|---------------|--------|--------|
| coverage | Agent(worker) | ✅ | 100% (45/45) |
| lint | Agent(Explore) — read-only | ✅ | Clean; nothing to route to a writer |

### Phase 4: Publish (after y/n)
| Skill | Dispatched to | Status | Result |
|-------|---------------|--------|--------|
| commit → PR | Agent(worker) | ✅ | PR #456 |
```

---

## Example Session

```
User: /orchestrate feature: add retry-safe webhook delivery with idempotent processing

Claude (coordinator):
## Orchestrating — I dispatch all work to subagents; I touch no files.

### Phase 0a: Grill (requirements fuzzy) — coordinator-direct
[Skill /grill-me + AskUserQuestion — I interview you]
→ Ambiguity = 0. Validation contracts:
   C1: a retried delivery does NOT re-process the same webhook twice.
   C2: delivery state is tenant-scoped (no cross-tenant leakage).
   C3: the delivery job is idempotent on retry after a partial failure.

### Phase 0b: Architecture
[Agent subagent_type="architect" — design + code location, given C1–C3]
→ Service + background job, per the project's existing patterns. Emits
   investigations/<TICKET>/tasks.md (4 ordered tasks, each 1 RED→GREEN, mapped to
   C1–C3). (No code written.)

### Phase 1A: Static analysis — parallel Agents (Explore, read-only)
[router-matched analyst 1] [analyst 2] [analyst 3] → all clean (or: none registered,
Explore scanned the diff against forbidden-patterns.md directly).

### Gate 2.5: Decompose (non-trivial → tasks.md exists)
I read tasks.md: 4 tasks, ordered, each one testable behavior mapped to a contract,
each names file + test. PASS. (Trivial fix would SKIP this — no tasks.md.)

### Phase 2: Implementation — worker in its OWN session
[Agent subagent_type="worker", "follow /tdd; walk tasks.md one RED→GREEN per task;
 satisfy C1–C3; consult Skill Router"]
→ Worker walks tasks.md (checks off 4/4), writes failing tests, implements, refactors.
   Returns diff + green suite. I wrote no code — the worker did, in its own session.

### Gate 3.5: VALIDATOR — DIFFERENT agent (creator/verifier separation)
[Agent subagent_type="validator", "follow /adversarial-review; you did NOT write
 this; verify C1–C3 against the diff scope in ../shared/diff-scope.md (variant
 content) — nothing is committed yet"]
→ C1 test-verified, C2 test-verified, C3 failed (retry path not idempotent) → REQUEST CHANGES. GATE FAILED.
   → loop: fresh Agent(worker) fixes C3 → fresh Agent(validator) → all test-verified. APPROVE.

### Phase 3: Quality — parallel Agents, write sets declared and disjoint
[coverage → worker, WRITE SET: the test files] [lint → Explore, read-only report — its
 fixes belong to the simplifier] [code-simplifier → code-simplifier, WRITE SET: the
 changed production files] → 100%, clean, no dead code.

### Phase 4: Publish
All gates passed. Ready to commit and create PR. Proceed? (y/n)
   ← I will NOT run git until you approve; then a worker runs commit→PR.
```
