---
name: stack-sync
description: Detects a project's technologies and versions from lockfiles/configs/CI, researches version-pinned best practices (Context7 MCP or web search when available, repo-only otherwise), and writes a durable, team-shared `.claude/skills/shared/best-practices.md` plus `stack.md` TODO fills — every proposal backed by file:line/URL evidence and confirmed per section before anything is written. Use for a full stack pass, to refresh best practices after a dependency bump, or to fill stack.md TODOs with a grounded answer instead of a guess.
allowed-tools: [Bash, Read, Grep, Glob, Edit, Write, mcp__context7__resolve-library-id, mcp__context7__query-docs]
disable-model-invocation: true
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Stack Sync — Detect, Research, Propose, Approve, Write

Builds the project's single durable, version-pinned view of its own technology stack. Where a
generic skill's TODO fallback (`../shared/config-priority.md#config-priority`) does a cheap, bounded, point-of-use scan, `/stack-sync` does
the full pass: detect every technology this repo actually uses, research current best practices
for the exact detected version, and write both `stack.md` section fills and
`.claude/skills/shared/best-practices.md` — never guessing, never writing without the user
confirming each section first.

## Precedence Rule (read this before proposing anything)

**Project conventions in `CLAUDE.md` / `stack.md` ALWAYS beat a generic best practice.** When a
researched practice conflicts with something the project already does deliberately, do NOT
recommend changing the convention. Record the conflict under that technology's **Deliberate
divergences** list in `best-practices.md` (schema in
[reference/best-practices-schema.md](reference/best-practices-schema.md)) and move on. This rule
applies at every phase below, most concretely at Propose/Approve — a proposed practice that
contradicts an existing convention is never presented as a fix, only as a documented divergence.

## The 7 Phases

Mechanical work (finding artifacts, parsing `best-practices.md`) is delegated to
[`scripts/stack_check.sh`](scripts/stack_check.sh) — read-only, no network, no writes, the same
script `--check` (below) and `qa_audit.sh` Check 9 use, so detection and parsing never drift
between the interactive and CI paths. Everything past detection (research, proposal, approval,
writing) is this skill's own judgment and cannot be scripted.

### Phase 1 — Scan

Run the mechanical scan to see what already exists before proposing anything new:

```bash
bash .claude/skills/stack-sync/scripts/stack_check.sh --report . .claude/skills/shared/best-practices.md
```

This enumerates detected artifacts, unregistered technologies, stale (>90 day) stamps, and
lockfile-vs-recorded version drift — read-only, always exits 0. If `best-practices.md` does not
exist yet (first run, or dojo's own dogfood case — no lockfile at all), note its absence rather
than treating the report as an error; Phase 2's no-lockfile fallback below covers this case.

### Phase 2 — Detect

From the bounded, documented artifact catalog in
[reference/detection-artifacts.md](reference/detection-artifacts.md), identify each technology and
its version, always with `file:line` evidence:

```bash
bash .claude/skills/stack-sync/scripts/stack_check.sh --detect .
```

Lockfiles are authoritative for versions. A manifest with no lock (or an ecosystem outside the
documented catalog) yields a `version-unpinned — pending` marker, never a guess. An ecosystem
outside the catalog is `undetected — add to catalog`, not silently skipped or fabricated.

**No-lockfile case (this happens on dojo itself, and on any bash/markdown/config-only repo).**
When the mechanical scan emits nothing, do not stop — propose technologies from **observed repo
artifacts** instead: file extensions actually present (`*.sh`, `*.md`), tool configs
(`.shellcheckrc`, `.editorconfig`), and CI files (`.github/workflows/*.yml`). Same evidence
discipline applies — cite the `file:line` or file path that grounds each proposed technology — and
mark these detections explicitly as **lower-confidence** (artifact-inferred, not lockfile-pinned)
in the Propose phase. Never invent a technology with no artifact backing it.

### Phase 3 — Research

For each detected technology, consult this degrading chain, in order, and stop at the first tier
that succeeds:

1. **Context7 MCP** (`mcp__context7__resolve-library-id` / `mcp__context7__query-docs`) if
   available — resolve the library ID for the detected technology and query for practices scoped
   to the detected version.
2. **Web search** otherwise.
3. **Repo-only** if neither is available — derive practices from the repo's own existing
   conventions for that technology (e.g. how it's already configured/used here).

Mark every section researched at tier 3 `source="repo-only"` and its prose "pending external
grounding" — this is a real, valid outcome, not a failure state, but it must never be presented as
externally verified when it isn't. **Never fabricate a source.** A URL or Context7 result that
wasn't actually returned by the tool must not appear in the proposal.

Every practice is **version-pinned**: it cites the version range it applies to and is scoped to the
technology's *detected* version from Phase 2, never a generic "latest" summary that may not apply
to what this repo actually runs.

### Phase 4 — Propose

Present a per-section diff — for each technology section and each `stack.md` TODO fill, show the
proposed text plus its evidence:

```
## <Technology>
+ Detected version: <version>  (evidence: <file>:<line>)
+ Practices:
  - [applies: <version-range>] <practice>  (source: <url | file:line | "repo-only — pending external grounding">)
```

If a proposed practice conflicts with an existing `CLAUDE.md`/`stack.md` convention, surface that
explicitly here as a **deliberate divergence** candidate (Precedence Rule above) — never blended
into the practice list as if it were a recommendation.

### Phase 5 — Approve

**Nothing is written for a section the user has not approved.** Present sections one at a time (or
grouped, if the user prefers) and wait for explicit confirmation before Phase 6 touches that
section. This is what makes `/stack-sync` confirm-first rather than auto-run — there is no
`AskUserQuestion` tool available to this skill; approval happens directly in the conversation, not
through a structured prompt tool. Honor edits and rejections exactly: an edited fill is written as
edited, a rejected section is skipped entirely (not written with a placeholder), and the user may
re-run Phase 4 for a section before approving it.

**The Approve gate cannot be waived by urgency or authority.** If the user says "skip the
questions / just write it", compress — present the full proposal in ONE compact block and require
ONE explicit confirmation — but never write with zero confirmation. Pressure is the test, not an
exception.

### Phase 6 — Write

Only after Phase 5 approval, write:

- **`stack.md` section fills** — the approved text, in place of the `TODO`.
- **`.claude/skills/shared/best-practices.md`** — created on first run with the header from
  [reference/best-practices-schema.md](reference/best-practices-schema.md), then one `## `
  section per approved technology. Every section carries exactly one `stack-sync:tech` marker
  comment with all four attributes (`name`, `version`, `stamped="<YYYY-MM-DD>"`,
  `source="context7|web|repo-only"`) — this is the schema's one fixed anchor, and the only thing
  `scripts/stack_check.sh` parses mechanically. A section is written only once it is complete
  (marker + required fields) — never partially.

Do not hand-edit an existing `stack-sync:tech` marker line outside this write step; re-running
`/stack-sync` is how a section gets refreshed.

### Phase 7 — Verify

Re-run the mechanical check in audit mode and confirm it exits 0 before finishing:

```bash
bash .claude/skills/stack-sync/scripts/stack_check.sh --audit . .claude/skills/shared/best-practices.md
```

Exit 1 here means a marker you just wrote is malformed — fix the section (per the schema) and
re-run before declaring the sync done. A nonzero exit is never reported to the user as "done."

## `--check`: cheap, read-only, casual drift probe

Distinct from a full sync — no research, no proposal, no writes. Safe to suggest casually (e.g.
before `/create-pr`, or periodically):

```bash
bash .claude/skills/stack-sync/scripts/stack_check.sh --report . .claude/skills/shared/best-practices.md
```

Reports unregistered technologies (in a lockfile, no `best-practices.md` section yet), stamps
older than 90 days, and lockfile-vs-recorded version drift. Always exits 0 — it is a report, not a
gate. If it surfaces drift, that is the cue to run a full `/stack-sync`, not an automatic trigger
to do so.

## Related Skills

Designed integration surface for the file this skill writes — see each skill's own `SKILL.md` for
whether the integration has landed yet:

| Skill | Relationship |
|---|---|
| `/architect` | Reads `best-practices.md` (when present) as a grounded research baseline. |
| `/tdd` | Reads `best-practices.md` for the test framework's recorded practices before a live docs lookup. |
| `/codebase-audit` | Cross-references `best-practices.md` in its Dependency Hygiene category to flag version drift. |
| `qa-audit` | Audits `best-practices.md` mechanically via the same `stack_check.sh --audit` this skill's Verify phase uses. |

## Pressure-Test

This skill was pressure-tested per the skill-creator protocol before shipping — the RED baseline,
the GREEN trace, and a combined-pressure variant are recorded in
[reference/pressure-test.md](reference/pressure-test.md).

## Kaizen: Continuous Improvement

> Improvements log lives in [`kaizen_log.md`](kaizen_log.md).

When you discover a new detectable ecosystem, a research-chain edge case, or a sharper divergence
example worth standardizing: complete the current sync first, then run `/kaizen` to record the
improvement — do not self-edit this file inline.

This is a fresh skill for this framework. No project-specific Kaizen history yet — start logging as
real syncs surface lessons here.
