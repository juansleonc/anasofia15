# `best-practices.md` schema

Canonical shape of `.claude/skills/shared/best-practices.md` — the file `/stack-sync` writes and
`scripts/stack_check.sh` parses mechanically. Both the skill's WRITE step and the script cite this
one file for the marker shape — the stack-sync:tech marker shape is parsed by this script AND
written by the stack-sync skill — change both together, in the same change.

## Fixed anchors

One `## ` heading per technology. Each heading is immediately followed (after the blank line the
template shows) by exactly one machine-readable marker comment, before any prose:

```markdown
## <Technology Name>

<!-- stack-sync:tech name="<canonical-id>" version="<detected>" stamped="<YYYY-MM-DD>" source="context7|web|repo-only" -->

- **Detected version**: <version>  (evidence: `<lockfile>:<line>`)
- **Sources**: <URL(s)> | `repo-only — pending external grounding`
- **Practices**:
  - `[applies: <version-range>]` <practice>  (source: `<url|file:line>`)
- **Deliberate divergences** (project convention wins — do NOT auto-change):
  - <generic practice X> overridden by <convention> (ref: `CLAUDE.md` / `stack.md#<anchor>`)
```

## `stack-sync:tech` marker spec

The marker is the **valid stamp** `stack_check.sh` parses for every mode (`--report`,
`--audit`). It carries exactly four attributes, in any order, each `key="value"`:

| Attribute | Required | Shape | Meaning |
|---|---|---|---|
| `name` | yes | non-empty string, canonical lowercase id (e.g. `node`, `bash`, `rails`) | stable identity used to match against detected lockfile technologies | <!-- residue-ok -->
| `version` | yes | non-empty string (a version number, range, or `unpinned`) | the version this section's practices are pinned to |
| `stamped` | yes | `YYYY-MM-DD`, a real calendar date | last-synced date; drives the >90-day staleness check |
| `source` | yes | one of `context7`, `web`, `repo-only` | where the recorded practices were grounded (research chain: Context7 MCP → web search → repo-only) |

A section is **well-formed** only if its `## ` heading is followed by exactly one marker line
before the next `## ` heading (or EOF), and all four attributes are present and individually
valid. A **missing marker** (heading with no marker before the next heading/EOF) or a
**malformed marker** (any attribute absent, empty, or failing its shape check above) is a
structural defect — `stack_check.sh --audit` hard-fails on it (feeds qa_audit Check 9).

## Divergence rules

- Project conventions (`CLAUDE.md` / `stack.md`) always beat a generic best practice.
- A conflict between a recorded generic practice and an existing project convention is recorded
  under that technology's **Deliberate divergences** bullet list — never surfaced as a
  recommendation to change the convention, and never auto-applied.
- Divergences are prose only; `stack_check.sh` does not parse this list (no marker, nothing
  mechanical depends on its shape).

## First-run template

`/stack-sync`, on a repo with no `best-practices.md` yet, seeds the file with this header and one
section skeleton per approved technology (this file is project-owned: created only by
`/stack-sync`, never installed or overwritten by `install.sh`):

```markdown
# Best Practices — <project>

> Generated and maintained by /stack-sync. Version-pinned to detected lockfile versions.
> Do not hand-edit the stack-sync:tech marker lines — re-run /stack-sync to refresh.
```

Each approved technology then gets one `## ` section in the shape above, appended during the
WRITE phase — never partially written; a section only exists once its marker and required fields
are complete.
