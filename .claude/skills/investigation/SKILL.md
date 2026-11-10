---
name: investigation
description: Enforces the RPI (Research/Plan/Implement) investigation-artifact standard for investigations/<TICKET>/ workspaces — canonical filenames, per-phase completeness gates, and closing findings into durable memory. Use when opening a new ticket investigation folder, checking an existing one before advancing to the next RPI phase or before commit/PR, auditing an old ad-hoc-named folder against the standard, or closing out a finished investigation into feedback_/reference_/project_ memory.
allowed-tools: [Bash, Read, Write, Edit, Grep, Glob]
disable-model-invocation: false
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Investigation Standard — Seed, Check, Close

## Purpose

`investigations/<TICKET>/` is the personal RPI (Research/Plan/Implement) scaffold defined in
`investigations/_RPI-TEMPLATE.md` — that file is the source of truth for *what* each phase must
contain. This skill enforces it: it turns the template's own "Exit check" bullets from a passive
self-check into an active gate, standardizes filenames so folders are diffable/greppable across
tickets, and closes the loop by making sure what was learned survives past the ticket in memory.

Empirically, that enforcement is missing today: 0 of ~80 genuine ticket folders contain a `tasks.md` even
though the template has required it for non-trivial work since it was written, and folder naming has
drifted into at least a dozen ad-hoc shapes (`investigation.md`, `diagnosis.md`, `estimate.md`,
numbered `NN-*.md`, `STATUS.md`). This skill exists to stop that drift, not to redesign the template.

## When to Use

- **Starting a ticket** — `investigations/<TICKET>/` is empty or missing → run **SEED**.
- **Before advancing an RPI phase** (Research → Plan, Plan → Implement, or before commit/PR) →
  run **CHECK** on the phase you're leaving.
- **Opening an old or unfamiliar folder** with ad-hoc filenames → run **CHECK** to audit it against
  the standard; it maps drifted names to canonical ones and reports gaps.
- **Finishing an investigation** (ticket resolved, PR merged, or work abandoned with a documented
  reason) → run **CLOSE** to extract durable lessons and mark the folder done.

## Non-Overlap (read this before assuming this skill does something else)

This skill owns exactly three things: **the artifact standard, lifecycle hygiene, and the
memory-closure act.** It does not do the thinking inside any phase.

| If you need to... | This skill does NOT do it — use |
|---|---|
| Trace a bug's mechanism, query the observability oracles (stack.md#observability) for root cause | the matching project skill if present (CLAUDE.md router / stack.md#analysts), else manual root-cause tracing via stack.md#observability |
| Design the fix, choose an approach, pick file/line targets | `/architect` |
| Turn a fuzzy ask into testable contracts (feeds `understanding.md`/design) | `/grill-me` |
| Verify an implemented diff is actually correct | `/adversarial-review` |
| Run TDD RED→GREEN cycles against `tasks.md` | `/tdd` |
| Maintain the durable memory files this skill writes into at CLOSE | `memory/` conventions (`feedback_*.md`, `reference_*.md`, `project_*.md`, seeded by `install.sh`) — this skill only *writes into* that convention at CLOSE, it doesn't define it |

If your task is any of the left column, stop and invoke that skill instead (or first, then come back
here for the artifact/gate layer).

## Canonical Filenames

| Phase | Canonical file | Owning skill(s) per RPI template |
|---|---|---|
| Research | `understanding.md` | `/architect`, `Explore`, Context7 |
| Plan | `<feature>-design.md` | `/architect`, `codebase-audit` (health/perf categories), or the matching project skill if present (CLAUDE.md router / stack.md#analysts) |
| Decompose (non-trivial only) | `tasks.md` | `/architect` emits, this skill's CHECK verifies presence+shape, `/tdd` walks it |
| Implement | `findings.md` (+ code, `seed_*`, `verify_*`) | `/tdd`, the matching project skill if present (CLAUDE.md router / stack.md#analysts, e.g. a factory/fixture check), `/adversarial-review` |
| Multi-agent runs | `orchestration-log.md` | `/orchestrate` |
| Lifecycle | inline `STATUS: ACTIVE` / `STATUS: CLOSED` header, first line of `understanding.md` (or a top-level `STATUS.md` if the folder already uses that shape) | this skill |

**Ad-hoc → canonical mapping** (drift observed across existing folders — use this table in SEED and
CHECK to recognize and normalize what's already there instead of creating a duplicate):

| Ad-hoc name(s) seen | Maps to |
|---|---|
| `investigation.md`, `diagnosis.md`, `root-cause.md`, numbered `0[0-3]-*.md` (ticket/root-cause/context) | `understanding.md` |
| `plan.md`, `estimate.md`, `*-design.md` variants, numbered `04-plan.md` | `<feature>-design.md` |
| numbered `0[5-9]-*.md` (backfill scripts/results), ad-hoc `*-results.md` | `findings.md` (or the script itself, if it's runnable code rather than prose) |
| standalone `STATUS.md` | leave as-is — it's an accepted equivalent of the inline header, don't force a merge |
| `README.md` | not a phase artifact by itself; if it duplicates `understanding.md` content, fold it in; if it's a pure navigation index for a multi-part folder, leave it and flag in CHECK output |
| `validation-contracts.md` | not an RPI phase file — it's `/grill-me` output that feeds the Plan's test strategy; leave alongside `<feature>-design.md`, don't rename |

Never delete an existing file to "fix" naming — rename (`git mv` if tracked, plain `mv` since
`investigations/` is gitignored) or, if content overlaps, merge and note the merge in the destination
file's own history, not by silently discarding the original.

## Mode 1 — SEED

Run when `investigations/<TICKET>/` doesn't exist yet, or exists but is empty/unstructured.

1. `mkdir -p investigations/<TICKET>` if missing.
2. `ls investigations/<TICKET>/` — if any files already exist, run the ad-hoc mapping table above
   before creating anything new. Never create `understanding.md` next to an unmapped `diagnosis.md`
   covering the same ground — that's the duplication this skill exists to prevent.
3. Create `understanding.md` seeded from `investigations/_RPI-TEMPLATE.md` Phase 1 (copy the
   checklist, not prose you'd have to delete later), with `STATUS: ACTIVE` as its first line.
4. Do NOT pre-create `<feature>-design.md`, `tasks.md`, or `findings.md` — they're born when their
   phase starts (an empty `tasks.md` sitting around unfilled is worse than no file, it's a false
   signal that decomposition happened).
5. If a `<TICKET>` metadata table (link, reporter, parent tickets) is available from context, fill
   it in now; otherwise leave the placeholder for the first real research pass.

**Exit**: `understanding.md` exists, has `STATUS: ACTIVE`, and no orphaned ad-hoc file duplicates it.

## Mode 2 — CHECK

Read-only by default: **emit a scorecard, don't silently rewrite files.** If CHECK finds a rename
opportunity (ad-hoc name with no canonical counterpart yet), it must ask before doing the `mv`
mirroring SEED's mapping step — CHECK's job is to surface the gap, not to make editorial calls about
content quietly.

Run against whichever phase doc the ticket is currently exiting. Each bar below is a **hard**
line — a doc that pattern-matches the checklist headings but doesn't clear the bar is a FAIL, not a
partial pass; these mirror the RPI template's own "Exit check" but make each clause independently
checkable.

**`understanding.md` (Research exit)**
- [ ] Mechanism is traced to at least one `file:line` reference, not described only in prose
- [ ] All write paths / callers touching the data are enumerated (grep evidence, not "should be all")
- [ ] Live-data grounding present with real numbers (query + result from the project's
      observability oracle per stack.md#observability; if the project has none, state
      "no oracle — unverified" explicitly) — a theory with zero production evidence fails this bar
- [ ] Multi-tenancy / timezone / money touchpoints are explicitly flagged one way or the other
      (even "N/A — no data-isolation dimension" counts; silence does not)
- [ ] Open questions/blockers section exists and is either empty-with-reason or lists what's blocking

**`<feature>-design.md` (Plan exit)**
- [ ] At least one alternative approach is named and rejected with a reason (an ADR with only the
      chosen approach isn't an ADR)
- [ ] Test strategy names adversarial cases (dup records, wrong-record selection, races) BEFORE
      happy-path cases — adversarial tests first, since they're the ones most likely to be skipped
      once the happy path is green
- [ ] Rollback/safety is addressed for anything destructive or money-touching — transactions,
      idempotency, backup — or explicitly marked N/A with why

**`tasks.md` (Decompose exit — non-trivial work only)**
- [ ] File exists (this is the single most-often-skipped artifact — verify it wasn't silently
      dropped because "the fix seemed small" when it actually touches multiple files/behaviors)
- [ ] Every task maps 1:1 to a testable behavior — one RED→GREEN cycle, not a batch of unrelated
      changes bundled as one checkbox
- [ ] Every task names its target file AND its test file
- [ ] Every task references the contract(s) (C1..Cn) it satisfies, if `/grill-me` contracts exist
      for this ticket
- Trivial single-behavior fix → absence of `tasks.md` is a PASS, not a gap. Don't manufacture a
  decomposition doc for a one-line guard fix.

**`findings.md` (Implement exit)**
- [ ] States what surprised you (if nothing did, say so explicitly — don't omit the section)
- [ ] States residual risk, even if "none identified — reviewed via adversarial-review"
- [ ] References the actual test run output or command, not just "tests pass"

Emit the scorecard as PASS/FAIL per bullet with a one-line reason for each FAIL, then a summary line:
`N/M bars cleared — {phase} is / is not ready to advance`.

## Mode 3 — CLOSE

The step that today only happens as a manual, easy-to-skip nudge — CLOSE makes it a deliberate act.

1. Re-read `findings.md` (and `understanding.md`/design doc if the lesson originated there) for
   anything that generalizes beyond this one ticket: a bug class, a gotcha in a shared system, a
   corrected assumption, a reusable script/pattern.
2. For each generalizable lesson, decide its tier:
   - Cross-session, high hit-rate, safety-relevant → `feedback_*.md` file.
   - Reusable factual/reference material (API shape, schema, runbook) → `reference_*.md` file.
   - Ticket-scoped, useful mainly for future archaeology on this exact area → `project_*.md` file.
   - Purely local/one-off with no reuse value → don't create a memory file at all; not everything
     needs to survive the ticket.
3. Write the memory file(s) into the project's own `memory/` directory (seeded once by `install.sh`,
   never clobbered) as `memory/feedback_<slug>.md`, `memory/reference_<slug>.md`, or
   `memory/project_<slug>.md` — this skill does not define a new memory schema, it feeds the
   existing project-relative one.
4. If the project maintains a `memory/MEMORY.md` index, add or refresh a one-line pointer bullet for
   the new file there. If the project has no such index, skip this step — it's optional, not a
   required artifact.
5. Run `bash .claude/skills/learning/scripts/memory_check.sh --report memory/`. On a `TRIGGERED:`
   finding (non-zero exit), **closing is blocked** — resolve it per
   `../shared/memory-conventions.md#prune-recipe` before flipping `STATUS: CLOSED`. INFO-only output
   (exit 0) does not block.
6. Set the folder's `STATUS:` header (inline or `STATUS.md`) to `STATUS: CLOSED`.
7. Verify any links referenced from the closed folder (memory file pointers, cross-references to
   other investigation folders) actually resolve — e.g. `test -f memory/feedback_<slug>.md`.
8. Never invent a memory entry to hit a quota — CLOSE with zero new memory files is a valid outcome
   for a ticket that taught nothing generalizable.

**Exit**: `STATUS: CLOSED` is set, any generalizable lesson has a memory file at the correct tier,
`memory_check.sh --report memory/` shows no TRIGGERED finding (or any it raised have been resolved),
and any links written during CLOSE (memory file paths, cross-references) resolve.

## Examples

**New ticket, clean start**: `investigations/CORE-901/` doesn't exist → SEED creates the folder and
`understanding.md` with `STATUS: ACTIVE`, no `<feature>-design.md`/`tasks.md` yet.

**Old folder, ad-hoc names**: `investigations/PICKLETOWN-OPEN-TIME/diagnosis.md` exists, no
`understanding.md` → CHECK maps `diagnosis.md` → `understanding.md` per the table, evaluates it
against the Research bars using its actual content, and reports the scorecard — it does not ask you
to duplicate the file under the canonical name unless you choose to rename it.

**Mid-implementation, deciding whether to advance**: `tasks.md` is missing on a ticket that touches
three services and a migration → CHECK flags this as a FAIL (non-trivial work, no decomposition),
not a silent pass, even though `understanding.md` and the design doc both look complete.

## Related Skills

| Skill | Relationship |
|---|---|
| `/architect` | Authors the Plan content and the `tasks.md` decomposition this skill's CHECK verifies |
| `/grill-me` | Authors `validation-contracts.md`, which CHECK's `tasks.md` bar cross-references |
| `/tdd` | Walks `tasks.md` one task per RED→GREEN cycle once CHECK has passed Decompose |
| `/adversarial-review` | Verifies the diff itself; this skill only verifies `findings.md` documents it happened |
| `/orchestrate` | Owns `orchestration-log.md`; this skill just recognizes it as a canonical filename |
| `/learning` | Feeds CLOSE — a mid-session correction captured via `/learning` often becomes the CLOSE-time memory write |

## Validation

Success criteria:
- ✅ Every active `investigations/<TICKET>/` folder has an unambiguous canonical file per phase
  present, or a documented reason it's skipped (trivial fix, phase not reached yet)
- ✅ No RPI phase advances while its CHECK scorecard shows an unresolved FAIL
- ✅ Every CLOSE either produces a correctly-tiered memory entry or explicitly declares none was
  warranted — never silent

Failure indicators:
- ❌ `tasks.md` absent on multi-file/multi-behavior work with no trivial-fix justification recorded
- ❌ A CHECK scorecard reports all-PASS by pattern-matching headings without checking the bar's actual
  content (e.g. an "Alternatives considered" heading with nothing under it counts as PASS — wrong)
- ❌ A CLOSE that adds a memory file whose links (path, index pointer) don't resolve, or that files a
  ticket-scoped lesson under `feedback_*`/`reference_*` instead of `project_*`

## Kaizen: Continuous Improvement

> "Every day we must improve" - 改善

**While executing this skill**, if you discover a better ad-hoc-name mapping, a phase bar that's too
strict/loose in practice, or a CLOSE edge case not covered above, you MUST:
1. Complete the current task.
2. Use the Edit tool to append the improvement to `kaizen_log.md`
   (format: `<!-- Kaizen: YYYY-MM-DD --> Improvement`).

Changelog lives in `kaizen_log.md` (bundled), not inline here.
