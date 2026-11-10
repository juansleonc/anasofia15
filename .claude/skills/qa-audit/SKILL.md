---
name: qa-audit
description: Run weekly, after adding/removing/renaming a skill, or after major CLAUDE.md updates to keep all skill files aligned with project conventions.
allowed-tools: [Bash, Read, Grep, Glob, Edit]
disable-model-invocation: true
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# QA Audit Skill - Kaizen Quality Gate

Continuous improvement audit for all Claude Code skills. Validates alignment with project requirements and identifies opportunities for enhancement.

## CRITICAL RULE

**NEVER modify `CLAUDE.md`** - it is a shared, versioned file.

When discrepancies are found between `CLAUDE.md` and reality:
1. **Report** the discrepancy in the audit
2. **DO NOT auto-fix** CLAUDE.md
3. **Skills can be updated** to match current project state
4. **Notify user** to update CLAUDE.md manually if needed

If a skill owns a structural inventory doc (e.g. a `reference/` file that tracks package/module/service counts), that doc — not this audit — is the source of truth for that inventory; this audit only checks it stays in sync with the filesystem.

## Philosophy

> "Every day we must improve" - Kaizen

This skill ensures all other skills remain aligned with:
- CLAUDE.md critical rules
- Project conventions
- Best practices
- Documentation accuracy

## Audit Process

### Step 1: Enumerate Skills

```bash
# List all installed skills.
# NOTE: the canonical skill filename is UPPERCASE `SKILL.md`. Run
# `find .claude/skills -iname 'skill.md' | wc -l` for the live count.
# `-iname` is kept for cross-platform portability (case-sensitive filesystems in CI),
# not because mixed casing is expected.
find .claude/skills -maxdepth 2 -iname "skill.md"

# Count skills (dynamic — do not hardcode the number)
find .claude/skills -iname "skill.md" | wc -l
```

### Step 2: Read CLAUDE.md for Current Requirements

```bash
# Get the critical-rules / conventions section (heading name varies by project —
# check this project's actual CLAUDE.md headings)
grep -A 20 "## Critical Rules" CLAUDE.md
grep -A 20 "## Conventions" CLAUDE.md

# Confirm CLAUDE.md points to the stack adapter
grep -n "stack.md" CLAUDE.md
```

If any skill declares a structural count (module count, package count, service count, etc.), the live-count command lives in `../shared/stack.md#audit-checks` — cross-check there rather than hardcoding a command here.

### Step 3: Validate Each Skill

For each skill, verify:

| Check | How | Pass Criteria |
|-------|-----|---------------|
| Command residue | Grep for hardcoded stack commands | None — commands in skills must go through references to `stack.md#commands`, never hardcode a stack command (see Step 4; this is dojo's most important QA rule) |
| Lint convention | Check the linting section | Matches `stack.md#commands` (e.g. modified-files-only vs. full-repo lint policy, if the project distinguishes) |
| Fixture/test-data policy | Check test patterns | Matches `stack.md#test-conventions` (cheapest fixture that still exercises the behavior is preferred) |
| Forbidden patterns | Check for violations | None present — matches `shared/forbidden-patterns.md` + `stack.md#forbidden-patterns` |
| Structural counts | Check any skill that declares a count of files/modules/packages | Declared dynamically (a command to run), never a hardcoded number |
| Coverage requirement | Check for a stated bar | Explicitly stated, matches `stack.md#coverage` |
| Time safety | Check for wall-clock/current-time usage | Matches `stack.md#forbidden-patterns` / `stack.md#test-conventions` |
| Claude mentions | Check commits/PRs | No AI references |
| Frontmatter description | Read the `description:` line | States triggers only (no workflow summary) — CSO Rule: `description:` must say WHEN to invoke, never summarize the skill's steps (defined in `skill-creator/SKILL.md`) |

### Step 4: Cross-Reference Validation

```bash
# Check for Claude/AI mentions (FORBIDDEN)
grep -rn "Claude\|Anthropic\|Co-Authored-By" .claude/skills/ --include="*.md"

# Check for raw current-time calls in examples not marked as counter-examples
# (Ruby/Rails example pattern shown — substitute this project's actual forbidden
# call per stack.md#forbidden-patterns)
grep -rn "Time\.now" .claude/skills/ --include="*.md" | grep -v "# BAD\|# WRONG\|❌"
```

**Command residue** is the check that matters most: commands in skills must go through references to `stack.md#commands`, never hardcode a stack command. Flag any hardcoded stack command as a violation. The automated form of this check lives in `qa_audit.sh` Check 2 — it runs a residue grep for known origin-platform terms and flags any hit that isn't inside a block labeled as an illustrative example.

### Step 5: Validate Against CLAUDE.md

For every rule this project's CLAUDE.md declares as critical, confirm at least one skill enforces it. Build a table: `Rule | Skill(s) That Should Enforce | Verified`.

(Ruby/Rails example — the shape this table took on the platform this skill was generalized from; not a fixed requirement for every project)

| CLAUDE.md Rule | Skill That Should Enforce | Verified |
|----------------|---------------------------|----------|
| Time-handling safety | project's time-safety skill, code-review, tdd | |
| Data isolation | code-review | |
| Financial transaction safety | code-review, project's payment-gateway skill | |
| API compatibility | code-review | |
| Payment idempotency | project's payment-gateway skill, code-review | |
| Command execution wrapper | commit, tdd, codebase-audit | |
| No AI mentions | commit, create-pr | |

> **Overlap note**: `/codebase-audit` covers a similar pre-release checklist (security, perf, DB, time handling). This skill audits the *skill files themselves*; `/codebase-audit` audits *application code*. They are complementary, not duplicates — run `/codebase-audit` on the codebase, `/qa-audit` on the skills directory.

### Step 6: Documentation Accuracy

Verify skills match actual project state:

```bash
# Any skill that declares a structural count (packages, modules, services) must
# derive it live rather than hardcoding a number — cross-check against the command
# in stack.md#audit-checks (or the skill's own reference doc, if it owns one).

# Spot-check that the commands referenced in skills actually exist/run — use the
# ones named in stack.md#commands (test runner, lint, coverage) as the source list.
```

## Audit Report Format

```markdown
## Skills QA Audit - [Date]

### Summary
- Skills audited: X
- Issues found: Y
- Improvements suggested: Z

### Critical Issues (BLOCKING)

| Skill | Issue | Severity | Fix Required |
|-------|-------|----------|--------------|
| commit | Contains an AI co-author attribution line | CRITICAL | Remove AI mention |

### Inconsistencies

| Skill | Finding | Impact |
|-------|---------|--------|
| some-skill | Declares a hardcoded count that no longer matches the filesystem | Medium |

### Missing Coverage

| CLAUDE.md Rule | Not Covered By Any Skill |
|----------------|--------------------------|
| Example: deferred-query handling | No dedicated check |

### Improvement Opportunities

| Skill | Suggestion | Priority |
|-------|------------|----------|
| code-review | Add observability-tool integration | Medium |
| tdd | Add system test section | High |

### Actions Taken
- [ ] Fixed: ...
- [ ] Updated: ...
- [ ] Created: ...

### Next Audit
Schedule: Weekly or after major changes
```

## Automated Checks

Run the audit script from the project root:

```bash
bash .claude/skills/qa-audit/qa_audit.sh
```

Each check prints its stable slug (e.g. `[residue]`) as a prefix on every `OK`/`FAIL`/`WARNING`/`SKIP`
line it emits, and is implemented as its own `check_*` function called from the dispatch list at
the bottom of the script — add a check by adding a function + one line in that list.

| Check | Severity | What |
|---|---|---|
| `[ai-mentions]` | Hard-fail | No AI-authorship attribution lines (co-author / generated-by credit naming the assistant) |
| `[residue]` | Hard-fail | No unlabeled hardcoded stack-command residue across `TRACKED_MD` (three explicit exemptions: a `(Ruby/Rails example` labeled fence, a `residue-ok: file` marker, or an inline `residue-ok` marker) |
| `[links]` | Hard-fail (DANGLING/UNSHIPPED) · Warning (PENDING) | Every citation in a tracked `.claude/skills/**` or `.claude/agents/**` markdown file resolves. Both syntaxes are scanned — a bracketed `](...)` link AND a bare code span — under every relative form: `(../)+<path>.md`, `.claude/<path>.md`, and a bare `reference/<path>.md`. Three outcomes: DANGLING (target missing), UNSHIPPED (target exists but is not git-tracked, i.e. a shipped file depending on something that will not ship), PENDING (missing but on the in-script `LINK_PENDING_ALLOWLIST` of optional-forward targets). Publishes the number of citations examined; a line carrying `<!-- citation-ok: <reason> -->` is exempt (see Exemption markers below) |
| `[ref-cycles]` | Hard-fail | The citation graph over `TRACKED_MD` plus the repo-root `CLAUDE.md` is acyclic. A cycle means neither document can be read in isolation — each defers to the other for the rule it is itself supposed to state. Collects edges with the same citation recogniser `[links]` uses, drops self-citations, and drops the progressive-disclosure breadcrumb pair (a non-`SKILL.md` file linking up to a `SKILL.md` that links back down to it). Prints one concrete cycle and the number of edges collected; pure awk, never `tsort` (which exits 0 on a cyclic input on macOS). **Known limitation**: detection is file-granular — once a SKILL.md links down into a detail document (the reverse edge the breadcrumb rule requires), every edge from that document back to the SKILL.md is dropped, breadcrumb or substantive alike, so a genuine circular deferral closing at that pair goes undetected. Currently latent, not active: exactly 3 edges are dropped on this repo's own tree, and disabling the exemption surfaces no cycle beyond each dropped edge's own intended trivial 2-cycle |
| `[fail-closed]` | Hard-fail | Every argument-dispatch `case` statement (subject `$1`/`${1}`/`$arg`/`$flag`/`$opt`, narrowly) over tracked `*.sh` under `.claude/` — plus `install.sh`, only in dojo's own dev tree (gated on `templates/stack.template.md`; a target's own `install.sh` is project-owned) — carries a catch-all-shaped arm (`*)`, `(*)`, an alternation ending in `\|*)`, or the getopts `\?)` marker) that refuses (a literal non-zero, variable — plain or braced — or propagated `$?` `exit`/`return`, or a call to `usage`/`die`/`fail`/`abort`) — or a separate `-*)`/`--*)`-shaped arm already refuses every unrecognized flag ahead of a catch-all that only accepts a bare positional argument. One-liners are checked inline; a line-leading `esac` closes the block whatever follows it; an unterminated block is reported rather than dropped. Line-oriented, not a shell parser — known limitations are listed in the check's header comment |
| `[disclosure-slots]` | Hard-fail (skip if no agent carries a `## Return format` section) | Every `.claude/agents/*.md` `## Return format` section (heading match case-insensitive; the section ends at the next `## ` heading) carries both an uncertainty-disclosure item and a non-action-disclosure item (what was observed but deliberately not acted on); plus two regression guards — `investigations/_RPI-TEMPLATE.md` and the `investigation` skill's `findings.md` exit bar retain their residual-risk / "what surprised you" bullets |
| `[repeatable-proof]` | Hard-fail (skip if no dojo-dev-tree marker, or no `tests/`) | Dojo-dev-tree-only (gated on `templates/stack.template.md`; an installed target's own test suite is project-owned, not proof of dojo's shipped payload). Every tracked `*.sh` under `.claude/` plus `install.sh` is named by at least one `tests/test_*.sh` — a shipped executable's proof must survive the session that produced it |
| `[coverage-doc]` | Warning | `coverage` skill references `stack.md#coverage` (skip if `coverage` isn't installed yet) |
| `[forbidden-doc]` | Warning | `tdd` skill references `forbidden-patterns.md` (skip if `tdd` isn't installed yet) |
| `[anchors]` | Hard-fail | `stack.md` / `stack.template.md` anchor parity — dojo-only (skip if either is absent; no target-side equivalent) |
| `[mentions]` | Hard-fail | Every `` `/<skill-name>` `` mention across `TRACKED_MD` resolves to a skill dir, `/opsx:`, the `KNOWN_EXTERNAL_SKILLS` allowlist, or a qualified line; self-asserts it visited ≥1 mention-bearing line before trusting its own verdict |
| `[artifacts]` | Hard-fail | No session-artifact leaks (parenthesized contract labels, contract-ID/process-noun collocations, or investigation-slug/ticket-shaped tokens) in tracked `.md`/`.sh` under `.claude/`/`templates/` — excludes `tests/` and the two project-authored files `shared/stack.md` / `shared/best-practices.md` (their dojo-side copies never ship); a literal, justified `allowlist_tokens` covers confirmed non-leaks |
| `[tiers]` | Hard-fail | Router tier ↔ `disable-model-invocation` frontmatter agreement, sourced from `templates/CLAUDE.project.md` or, if absent, the target's own `CLAUDE.md` `dojo:router` marker block |
| `[bestpractices]` | Hard-fail | `best-practices.md` structural audit via `stack_check.sh --audit` (skip if `stack-sync` or the file isn't present yet) |
| `[duplicate-blocks]` | Hard-fail, no allowlist (skip if no dojo-dev-tree marker) | Dojo-dev-tree-only (gated on `templates/stack.template.md`; dojo's payload is checked where it is authored, and an installed target's own agents, commands and docs are project-owned, not dojo's to police). No run of 25 consecutive words, taken from any block of any `TRACKED_MD` file, appears in two or more distinct files. A block is a paragraph normalized so wrapping and blockquote markers do not matter (list items, headings, table rows, and fenced-code or frontmatter lines stand alone). Each shared run is reported with its file count, a 60-character excerpt, and every file carrying it (`file:line` of its block). One canonical home per rule — an allowlist entry here would just re-certify a duplication instead of removing it |
| `[config-priority-citation]` | Hard-fail | Every `Config Priority` line cites the one canonical home, `shared/config-priority.md`, rather than restating its text (which `[duplicate-blocks]` would catch); holds no copy of the canonical sentence itself |
| `[principles-doc]` | Hard-fail (skip if neither the document nor a consumer of it is present) | `shared/principles.md` exists and is git-tracked (an untracked copy never ships); carries a `Consumers:` line; every `## P<n>` section has a consumed-by marker, an axis, an `(a)`/`(b)` classification, an `Incident:` line with a `file:line` or code-spanned commit, an invariant naming no language construct, and exactly one code-span Layer-2 deferral (never a markdown link) as its last line; a `(b)` section has exactly one question mark; the `## Rejected` list outnumbers the admitted set and each entry names its failed gate; no URL within three lines of a book-only source. Runs in installed targets too, since the document ships. Text pins, evadable by rephrasing: anti-decay, not proof |
| `[desc-budget]` | Warning | `description:` line stays under the 200-word budget |

> Full check logic lives in [`qa_audit.sh`](qa_audit.sh). Edit that file to add or change checks.

### Exemption markers

Two checks carry a deliberate, in-document escape hatch for the "the checker is right in general,
wrong on this line" case. Both are visible acts in the diff — never a silent default — and both
are line- or file-scoped, never global.

| Marker | Check | Scope | Use for |
|---|---|---|---|
| `<!-- residue-ok: file -->` | `[residue]` | whole file | a document that is a worked stack example cover to cover |
| `<!-- residue-ok -->` | `[residue]` | that one line | a line that necessarily quotes the residue pattern it defines |
| `<!-- citation-ok: <reason> -->` | `[links]` and `[ref-cycles]` | that one line | a line quoting ANOTHER file verbatim, whose citation string is relative to the quoted file's directory and so does not resolve from this one |

`citation-ok` has no file-level variant and its `<reason>` is mandatory (at least one non-space
character). It exists because the alternatives all damage the document: re-pathing a quotation
turns it into a misquote of the text it claims to reproduce, and stripping its backticks destroys
the formatting the quotation exists to reproduce. A marked line is skipped by BOTH the link
resolver and the cycle graph — it is not a live citation, so it must not become a live edge
either. The marker exempts the whole LINE, not one citation on it: a line carrying the marker
plus more than one citation exempts every citation on that line, including one the author never
individually looked at. Every current use is a single-citation table row, so nothing is hidden
today, but keep a marked line to exactly one citation — that discipline, not the mechanism, is
what makes the exemption safe in practice.

### Migration note — `[links]` is a BREAKING change for existing installs

`[links]` used to be warning-only and looked at bracketed `](../shared/…)`-style links under
`.claude/skills/` alone. It now hard-fails on DANGLING and UNSHIPPED, and additionally scans code
spans, `.claude/agents/`, `.claude/<path>.md` and bare `reference/<path>.md` citations. A project
updating dojo can therefore go from a passing audit to a failing one with no source change of its
own. Expect the first post-update run to surface real, previously invisible broken citations:

1. Fix the path where the citation is genuinely wrong — this is the common case.
2. Add `<!-- citation-ok: <reason> -->` to the line where the "citation" is a verbatim quotation
   of another file's text.
3. Add the target to `LINK_PENDING_ALLOWLIST` in `qa_audit.sh` (full canonical path plus a reason,
   one per line) only where the file legitimately may not exist yet in a fresh install.

`[ref-cycles]` is new in the same release and hard-fails from day one.

## Kaizen Improvement Cycle

```
┌─────────────────────────────────────────────────────────┐
│  1. AUDIT: Run QA checks on all skills                  │
│            ↓                                            │
│  2. IDENTIFY: Find gaps, inconsistencies, violations    │
│            ↓                                            │
│  3. FIX: Correct critical issues immediately            │
│            ↓                                            │
│  4. ENHANCE: Add missing coverage, improve docs         │
│            ↓                                            │
│  5. VERIFY: Re-run audit to confirm fixes               │
│            ↓                                            │
│  (repeat weekly or after major changes)                 │
└─────────────────────────────────────────────────────────┘
```

## Example Audit Session

```
User: /qa-audit

Claude:
## Skills QA Audit - [run date]

### Scanning skills directory...
Found N skills (run `find .claude/skills -iname 'skill.md' | wc -l` for live count):
- adversarial-review, architect, brainstorm, codebase-audit, commit
- coverage, create-pr, grill-me, investigation, kaizen
- learning, optimize-skill, orchestrate, qa-audit, skill-creator, tdd
(list illustrative — run the find command for the current canonical set)

### Running automated checks...

✓ No AI mentions in commit messages
✓ Commands go through stack.md references (no hardcoded stack commands)
✓ No dangling/unshipped citations (N citations examined across M files)
✓ No citation cycles (N citation edges)
✓ Coverage requirement matches stack.md#coverage
✓ Forbidden patterns documented
✓ Time safety patterns correct

### Cross-referencing with CLAUDE.md...

| Rule | Coverage | Status |
|------|----------|--------|
| Time-handling safety | tdd, adversarial-review | OK |
| No AI mentions | commit, create-pr | OK |
| Command execution wrapper | commit, tdd, codebase-audit | OK |

### Result: ALL CHECKS PASSED

No critical issues found. Skills are aligned with project requirements.

Next suggested improvements:
1. Add project-specific analyst skill mappings to stack.md#analysts
2. Consider adding a coverage-gate skill for CI
```

## Scheduling

Run QA audit:
- Weekly (recommended)
- After major CLAUDE.md updates
- After adding/modifying skills
- Before major releases

---

## Kaizen: Continuous Improvement

> "Every day we must improve" - 改善

**While executing this skill**, if you discover:
- A new check that should be added
- A missing validation pattern
- A better audit workflow

**You MUST**:
1. Complete the current QA audit first
2. Then invoke `/kaizen` to log improvements — do NOT self-edit this file inline

**Changelog**: see [`kaizen_log.md`](kaizen_log.md) (counts recorded there reflect the session they were written and may be stale — always run `find .claude/skills -iname 'skill.md' | wc -l` for the live count).
