# Orchestrate — Phase→Skill Tables & Parallel Execution Reference

Relocated from SKILL.md body (progressive disclosure). The body keeps the decision
core (Coordinator Contract, Delegation Protocol, Phase Gates); this file holds the
detailed phase→skill catalog and the parallel/sequential execution rules.

> **Single source of truth for *which* skill fires on *which* glob is
> `CLAUDE.md`'s Skill Router (auto-invoke tier + per-file/glob triggers)** —
> `worker`/`validator` agents auto-load it. The tables here describe the orchestration
> *phasing & execution locus* (parallel vs serial, Explore vs worker vs validator), not
> the glob→skill routing, which is not duplicated. dojo ships the *template's* per-file table
> **empty** — it fills in per-project as `/learning` and `/kaizen` observe real
> sessions (see `templates/CLAUDE.project.md`); until then, Phase 1A/1B below falls back
> to `Explore` agents doing the pattern-scan directly.

## Table of Contents
- [Execution Locus Legend](#execution-locus-legend)
- [Available Skills by Phase](#available-skills-by-phase)
- [Parallel Execution Rules](#parallel-execution-rules)
- [Must Run Sequentially (Dependencies)](#must-run-sequentially-dependencies)
- [Context-Aware Skill Selection](#context-aware-skill-selection)

---

## Execution Locus Legend

How the coordinator runs each skill:

- 🟣 **coordinator-direct** via `Skill` (non-mutating, interactive) = `/grill-me`, `/brainstorm`, `/learning`.
- 🟢 **delegated-worker** via `Agent subagent_type="worker"` (edits code) = `/tdd`, `/coverage`, `/commit`, `/create-pr`, plus any router-matched implementation skill (`CLAUDE.md` Skill Router).
- 🔵 **delegated-validator** via `Agent subagent_type="validator"` = `/adversarial-review`, or the router-matched review skill if present.
- 🔎 **delegated-analyst** via `Agent subagent_type="Explore"` (read-only) = the analyst skills registered in `stack.md#analysts` plus router-matched skills from `CLAUDE.md`; if none are registered, `Explore` runs the pattern-scan directly with no fixed skill name.

The coordinator itself never runs any of them in-thread except the 🟣 set.

**Split-locus pattern** (inbound review feedback — human reviewers or automated bots): if the project
has a skill for this (the matching project skill if present, per the Skill Router), its **triage/gate**
phase is 🟣 coordinator-direct (read-only + `AskUserQuestion` to clarify ambiguous feedback — a worker
can't ask), gated through the shared [`confirm-loop-gate`](../../shared/confirm-loop-gate.md), and its
**implement** phase is 🟢 delegated-worker via `/tdd` (the fix edits code). Never run the whole thing in
one locus: gate in-thread, then dispatch the confirmed fixes to a worker. Same split pattern as
grill-me 🟣 → tdd 🟢.

---

## Available Skills by Phase

### Phase 0 — Ideation (coordinator-direct 🟣)
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| `/brainstorm` | Divergent: explore the solution space, decompose, generate 2-3+ approaches, pick a direction | ✅ Only when the spec is *unformed* (WHAT/HOW open) — before grill-me |

### Phase 0a — Requirements (coordinator-direct 🟣)
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| `/grill-me` | Interrogate user until ambiguity=0; emit validation contracts | ✅ For fuzzy feature/refactor specs (before architect) |

> **`/brainstorm` vs `/grill-me`** — both are coordinator-direct (require `AskUserQuestion`; subagents can't call it). `/brainstorm` is the **divergent** front-end (open options, pick a direction) used only when the spec is *unformed*; its output feeds `/grill-me`, the **convergent** step (kill ambiguity → emit contracts). If the approach is already known, skip straight to `/grill-me`.

### Meta Skills (Skill maintenance — manual only, no auto-trigger except where noted)
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| `/orchestrate` | Master coordinator (THIS SKILL) | ✅ **Smart auto-detect** |
| `/investigation` | Seed/check/close the RPI `investigations/<TICKET>/` scaffold | ✅ Auto-seeded by the first dispatched worker when the folder is missing |
| `/kaizen` | Continuous skill improvement | 🔵 Manual only |
| `/skill-creator` | Detect skill gaps, create new skills | 🔵 Manual only |
| `/optimize-skill` | Tighten an existing skill | 🔵 Manual only |
| `/qa-audit` | Audit the skill set for gaps and drift | 🔵 Manual only |
| `/codebase-audit` | Periodic project health check | 🔵 Manual only |
| `/learning` | Capture user corrections → memory + skills | ✅ Auto-suggest on correction signals |

### Architecture Skills (PHASE 0 - Before coding)
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| `/architect` | System design, code location, patterns; **emits `tasks.md` (ordered micro-task checklist, 1 task = 1 RED→GREEN) for non-trivial work** | ✅ For new features |

### Static Analysis Skills (PHASE 1A - Can run in parallel)
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| Router-matched analyst skills (`CLAUDE.md` Skill Router) or the ones registered in `stack.md#analysts` | Stack-specific pattern scans (e.g. banned-API usage, boundary violations, auth checks — whichever the project registers) | ✅ if registered; otherwise dispatch `Explore` directly for a read-only scan of the diff against `../../shared/forbidden-patterns.md` + `stack.md#forbidden-patterns` |

### Code Analysis Skills (PHASE 1B - After TDD)
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| Router-matched implementation-detail analyst skills, or `stack.md#analysts` | Data-isolation, performance, authorization patterns — whichever apply to this project | ✅ if registered; otherwise `Explore` reviews the diff manually against `stack.md#audit-checks` |

### Development Skills (Sequential)
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| `/tdd` | Test-driven development | ✅ |
| `/coverage` | 100% coverage verification | ✅ |
| Router-matched job/queue-pattern skill, if present | Background-job/queue convention validation | ✅ For job/queue code, if a matching skill is registered |

### Domain Skills (PARALLEL - Context-aware)
Domain workflows compose from the router + `stack.md#analysts` per project — dojo does not hardcode a
fixed domain-skill list here. Whatever the project registers (payments, compliance, multi-tenancy,
resilience/retry patterns, …) plugs into Phase 1B / Gate 4 the same way: `Explore` dispatched with the
router-matched skill named in the prompt.

### Debugging Skills
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| Router-matched debug skill, if present; otherwise `Explore` doing root-cause investigation | Production/runtime debugging via `stack.md#observability` + code search | ✅ |

### Quality Skills (Post-development)
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| `/adversarial-review` | Deep, contract-driven review (also the Gate 3.5 validator skill) | ✅ |
| `/qa-audit` | Skills quality audit | 🔵 Manual |
| `/kaizen` | Skill quality and improvement audit | 🔵 Manual only |

### Inbound Review Feedback (split-locus 🟣→🟢, if the project has a matching skill)
See the **Split-locus pattern** note above the tables. There is no dojo-shipped skill dedicated to
this today — apply the pattern manually (triage in-thread with `confirm-loop-gate`, implement via
`/tdd`) unless a router-matched project skill exists.

### Git Skills (User-triggered)
| Skill | Purpose | Automatic |
|-------|---------|-----------|
| `/commit` | Create git commit | 🔵 Manual |
| `/create-pr` | Create pull request | 🔵 Manual |

---

## Parallel Execution Rules

### Phase 1A: Static Analysis (ALL PARALLEL)
| Skills | Reason |
|--------|--------|
| Router-matched analyst skills / `stack.md#analysts` (N independent scans) | Different analysis domains, no dependencies between them |

### Phase 1B: Domain Skills (ALL PARALLEL - if applicable)
| Skills | Reason |
|--------|--------|
| Router-matched domain skills (N independent scans) | Domain-specific, independent analysis — see "Domain workflows" above |

### Phase 2.5: Code Validation (ALL PARALLEL - after TDD)
| Skills | Reason |
|--------|--------|
| Router-matched implementation-detail analysts | Validate implementation details (job/queue patterns, performance, data isolation, authorization — whichever apply) |

### Phase 3: Quality (ALL PARALLEL)
| Skills | Reason |
|--------|--------|
| coverage, lint (`stack.md#commands`), code-simplifier, comments (read-only `Explore`) | Independent quality checks |

> **Parallel = multiple `Agent` calls in one batch** (like adversarial-review's "all agents IN PARALLEL"). Read-only analysis → `Explore`; implementation → `worker`; verification → `validator`. The coordinator only dispatches and aggregates.

---

## Must Run Sequentially (Dependencies)
| First | Then | Reason |
|-------|------|--------|
| **brainstorm** | **grill-me** | Diverge + pick a direction before killing ambiguity (only when spec is unformed) |
| **grill-me** | **architect** | Resolve requirement ambiguity + emit contracts before designing |
| architect | Phase 1A | Must design before analyzing |
| Phase 1A | Phase 1B | Static analysis informs domain checks |
| Phase 1B | **Gate 2.5 decompose** | Domain knowledge informs the task breakdown (non-trivial only) |
| **Gate 2.5 decompose** | TDD | Each task = 1 RED→GREEN cycle the worker walks in order (skipped for trivial fixes) |
| TDD | **validator GATE** | Independent agent verifies contracts before anything else |
| **validator GATE** | Phase 2.5 / Phase 3 | Quality runs only after the gate passes |
| Phase 2.5 | Phase 3 | Validation before quality checks |
| Phase 3 | commit | Quality gate must pass |
| commit | create-pr | Must commit before PR |
| root-cause investigation | fix implementation | Must understand the issue before dispatching a worker to fix it |

---

## Context-Aware Skill Selection
| If task is... | Coordinator dispatches FIRST... |
|---------------|---------------------|
| **Idea unformed** (WHAT/HOW open; multiple approaches plausible; multi-subsystem request) | **brainstorm (coordinator-direct 🟣)** → then grill-me → architect → **decompose (`tasks.md`)** → tdd |
| New feature request (fuzzy spec, approach known) | **grill-me (coordinator-direct)** → then architect → **decompose (`tasks.md`)** → tdd |
| New feature request (clear spec) | architect (via Agent, emits `tasks.md`) → **decompose gate** → tdd |
| New module/package | brainstorm (if approach open) → grill-me → architect → **decompose (`tasks.md`)** → tdd |
| Major refactor | grill-me → architect → **decompose (`tasks.md`)** → tdd |
| New integration | brainstorm (if approach open) → grill-me → architect → **decompose (`tasks.md`)** → tdd |
| Security fix | security-hardening workflow |
| Performance issue | performance-optimize workflow |
| **Review feedback arrives on a PR** (human, or an automated bot) | **triage/gate (coordinator-direct 🟣, confirm-loop-gate)** → then worker via `/tdd` 🟢 for each confirmed item |

> **Skill Router is canonical**: before composing ANY worker/analyst dispatch prompt, consult
> **`CLAUDE.md`'s Skill Router (auto-invoke tier + per-file/glob triggers)** and name every
> mandatory skill that matches the globs/packs the subagent will touch. This is how the pure
> coordinator preserves convention enforcement without running the checks itself. dojo ships this
> per-file table **empty** by design — `/learning` and `/kaizen` populate it as real sessions surface
> real glob→skill patterns for the installing project (see `templates/CLAUDE.project.md`); don't
> front-load it here with invented globs.
