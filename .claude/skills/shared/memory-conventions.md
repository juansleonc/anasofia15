# Memory Conventions

> Framework-owned. Governs the project-relative `memory/` directory (seeded once by `install.sh`,
> gitignored, written into by `/learning` Phase 4 and `/investigation` CLOSE). Enforced mechanically
> by `../learning/scripts/memory_check.sh --report`; this document is the human-readable half of the
> same contract — read it alongside that script, not instead of it.

## File format

Each memory file lives at `memory/<tier>_<slug>.md`, where `<tier>` is `feedback`, `reference`, or
`project`. Frontmatter shape:

```yaml
---
name: <tier>_<slug>
description: "<one-line description used by future Claude to decide relevance>"
updated: "<YYYY-MM-DD>"
metadata:
  node_type: memory
  type: <tier>
  originSessionId: <session-uuid>
supersedes: <target-memory-name>   # optional hard edge
corrects: <target-memory-name>     # optional hard edge
---
```

`name:` is the slug itself, not a prose title. There is no top-level `type:` key — `type:` lives
nested under `metadata:`. `updated:` is a quoted `"YYYY-MM-DD"` string.

**Hard edges.** `supersedes:` and `corrects:` are optional frontmatter keys whose value is the
`name:` of another memory file. They are structural claims — a missing target is an integrity
defect, not a style nit (`memory_check.sh` flags it as a broken edge).

**Soft relations.** Use `[[wikilinks]]` in the body prose to point at a related memory by its
`name:` (slug) when the relationship isn't a hard `supersedes`/`corrects` claim — just an
associative pointer a reader might want to follow. A `[[wikilink]]` whose target doesn't exist is
advisory, not structural (see the dangling-wikilink heuristic below).

## Index

`memory/MEMORY.md` is a flat index: one line per memory file, newest last, in the shape:

```markdown
- [[slug]] — updated: <YYYY-MM-DD> — <one-line hook, ~150 chars>
```

Cap is stated once, in [Thresholds](#thresholds) below — this section doesn't restate the digit.

## Thresholds

Two numbers govern when the health check escalates from informational to triggered:

- **Memory count trigger: 40.** Once the number of memory files (`feedback_*`, `reference_*`,
  `project_*`, excluding `MEMORY.md` itself) reaches 40, a distill pass is due.
- **Index cap: 200 lines.** Once `memory/MEMORY.md` exceeds 200 lines, it needs pruning per the
  [Prune recipe](#prune-recipe).

These two numbers mirror the `MEMORY_TRIGGER_COUNT` and `INDEX_CAP` constants at the top of
`../learning/scripts/memory_check.sh` exactly — **change both together**, in the same change. This
table is the human-readable mirror; the script is the enforcer. No other document restates either
digit.

## Edges (v1)

v1 ships exactly two hard edge types: `supersedes` and `corrects`. No richer typed-edge schema
(`relates_to`, `duplicates`, `refines`, …) ships in v1.

**Rationale.** A prior attempt at this graph on the platform this framework was extracted from
designed 4+ edge types and shipped with 0 files actually marked with any of them — a rich schema
that goes unused is worse than a minimal one that gets adopted. Associative relationships that
don't need integrity enforcement use `[[wikilinks]]` instead of a new edge key. Expand only if a
real corpus demonstrates the two hard edges aren't enough.

## Distill on CLOSE

When an investigation closes (`/investigation` CLOSE), any lesson that generalizes beyond the one
ticket gets distilled into a correctly-tiered memory file (`feedback_*` for cross-session
safety-relevant rules, `reference_*` for reusable factual material, `project_*` for ticket-scoped
archaeology) rather than left buried in a closed investigation folder. This document states the
rule; `../investigation/SKILL.md` executes it at CLOSE time.

## Prune recipe

When `memory_check.sh --report` reports a `TRIGGERED:` finding, resolve it in this order — order
matters, each step depends on the previous one having happened:

1. **merge duplicates** — for a near-duplicate pair, fold the weaker file's content into the
   stronger one so nothing is lost.
2. **Mark the loser `superseded`** — set the merged-away file's `supersedes:`/`corrects:`
   relationship (or an explicit superseded marker) so the audit trail survives the merge.
3. **De-index the superseded entry** — remove its bullet from `memory/MEMORY.md`.
4. **Only then trim** — if the index is still over cap after de-indexing genuinely superseded
   entries, trim further.

Trimming before de-indexing leaves a dangling index pointer. De-indexing before marking loses the
audit trail. The order above avoids both failure modes.

**False positive?** If a flagged near-duplicate pair is legitimately two distinct memories, add mutual `[[wikilinks]]` between them — the mutual-link exemption then silences that pair permanently.

## Harness memory — out of scope v1

The Claude Code harness keeps its own memory under `~/.claude/projects/<slug>/memory/` (e.g.
`MEMORY.md` there). That is the **harness's** memory, not this project's `memory/` directory, and
it is a different artifact with a different owner. `memory_check.sh` is never pointed at it, and
these conventions do not govern it in v1 — it is explicitly out of scope.
