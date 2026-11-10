# CLAUDE.md — project instructions

> Seeded by dojo (https://github.com/juansleonc/dojo). Edit freely — this file is project-owned; dojo never overwrites it.

**Config priority.** This file is the source of truth for how agents work in this repo. A local
`CLAUDE.local.md` (gitignored), where present, overrides it for personal/machine-specific
preferences. Stack specifics — commands, test conventions, coverage, audit checks, VCS format —
live in `.claude/skills/shared/stack.md`, not here; skills read that file by anchor instead of
hardcoding a language or tool.

<!-- dojo:router:start -->
## Skill Router

Three tiers. Tiers 1 and 2 are always-on trigger maps — if a row matches the situation you're
in, act on it before proceeding. Tier 3 is never triggered automatically.

### 1. Auto-invoke (the model fires these itself)

| Situation | Use |
|---|---|
| Unformed idea | `/brainstorm` |
| Ambiguous requirement | `/grill-me` |
| New feature / major refactor needs a design | `/architect` |
| ANY behavior change | `/tdd` (mandatory) |
| After implementation, before commit | `/adversarial-review` (GATE) |
| Coverage check after tests | `/coverage` |
| Non-trivial ticket start | `/investigation` (opens `investigations/<TICKET>/`) |
| Full multi-skill pipeline | `/orchestrate` |
| User corrects or redirects prior output | `/learning` |
| Handing over commands, a runbook, or a script someone else will run | `/tdd` — the artifact's own local execution IS the RED step |

### 2. Confirm-first (suggest, then wait for the user's go-ahead)

These are deliberately human-gated (`disable-model-invocation: true`) — propose them, don't run
them unasked; confirm-first means suggest, never auto-run.

| Situation | Use |
|---|---|
| Ready to commit | suggest `/commit` |
| Ready for PR | suggest `/create-pr` |
| Non-trivial diff heading to a PR | suggest `/thermo-review` before `/create-pr` |
| Empty/incomplete stack.md, or unregistered technology encountered | suggest `/stack-sync` |
| Starting isolated feature work | suggest `/worktrees` |
| Implementation complete, ready to integrate | suggest `/finishing-branch` |

### 3. Manual-only (never suggest unprompted)

Invoked deliberately by the user, never on a trigger:

- `/skill-creator` — scaffold a new skill
- `/kaizen` — turn recurring friction into a framework improvement
- `/optimize-skill` — tighten an existing skill
- `/qa-audit` — audit the skill set for gaps and drift
- `/codebase-audit` — periodic health check

<!-- dojo:router:end -->

### Per-file / glob triggers

<!-- Project-owned. This section deliberately sits OUTSIDE the dojo:router markers above:
     everything between them is rewritten wholesale by `install.sh --update`, so rows kept
     there would be destroyed on the next update. Empty until the project's conventions
     emerge. /learning and /kaizen append rows here (e.g. "editing app/models/**/*.rb →
     remind about X") as real sessions surface them. Do not front-load this table. -->

## Delivery lane

The decision rule for choosing a lane, the artifact-placement table, and the investigations/
slug rule all live once in `.claude/skills/shared/delivery-lane.md` — read it there, not here.
Non-trivial work still gets an `investigations/<TICKET>/` folder for local understanding,
structured per `investigations/_RPI-TEMPLATE.md`. See `.claude/skills/investigation/SKILL.md`
for the canonical definition, phase gates, and ad-hoc-name mapping.

## Stack

Commands, test conventions, coverage, audit checks, VCS format: see
`.claude/skills/shared/stack.md`. Sections marked TODO get filled as skills run — keep them
current.
