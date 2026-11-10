---
name: orchestrate
description: Use when a task spans multiple skills or subagents and needs planning, delegation, quality-gating, and aggregation across a multi-phase pipeline (feature, bug fix, migration, refactor, security/perf hardening). Pure coordinator — never edits files or runs mutating commands itself; dispatches all work to subagents.
allowed-tools: [Agent, Read, Grep, Glob, AskUserQuestion, Skill, Workflow]
disable-model-invocation: false
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

> **Bundled references** (read on demand — ~0 tokens until opened):
> - Per-phase skill catalog + parallel/sequential rules + context-aware selection → `reference/workflows.md`
> - Pipeline shape (parallel-fan-out vs serial-gate diagram) → `reference/dependency-graph.md`
> - Status-tracking format + end-to-end example session → `examples.md`
> - Glob→skill routing (canonical, single source of truth) → **`CLAUDE.md`'s Skill Router
>   (auto-invoke tier + per-file/glob triggers)** (`worker`/`validator` auto-load it)

---

## 🧭 Coordinator Contract (READ FIRST — HARD RULES)

`/orchestrate` is a **PURE ADMINISTRATIVE COORDINATOR**. It plans, delegates, gates, and aggregates. It performs **NO real work itself** — ALL code, tests, migrations, reviews, and mutating commands run in **SUBAGENT sessions** via `Agent` (or `Workflow`).

**MAY:**
- **Read** for context: `Read`, `Grep`, `Glob`.
- **Ask the user**: `AskUserQuestion` — grill requirements (Phase 0a), request gate approval.
- **Plan & track**: decompose into phases; keep running status of dispatched vs returned.
- **Dispatch subagents**: `Agent` (`subagent_type: …`), parallel or serial, each passed self-contained context.
- **Delegate stateless fan-out to `Workflow`**: deterministic multi-agent pipelines for headless/stateless phases (Phase 1A/1B analysts, Phase 3 quality, adversarial find→verify). A `Workflow` call is VALID delegation — its agents run in their own sessions and do the editing/analysis there, exactly like `Agent`. The coordinator never touches files regardless.
- **Invoke ONLY these non-mutating skills in-thread** via `Skill`: `/grill-me`, `/brainstorm`, `/learning` (they interview the user; never touch project code).
  - **Split-locus pattern (inbound review feedback)**: if the project has a skill for triaging inbound PR/bot review feedback (the matching project skill if present, per CLAUDE.md's skill router), run its triage/gate phase in-thread (read-only + `AskUserQuestion` to clarify ambiguous feedback — a worker can't ask) using the shared [`confirm-loop-gate`](../shared/confirm-loop-gate.md), then delegate the confirmed fixes to a `worker` via `/tdd`, one item at a time. Never run triage and implementation in the same locus.

**MUST NEVER:**
- ❌ Edit, Write, or create any project file (no `Edit`/`Write` granted).
- ❌ Run any mutating shell command — no `git add/commit/push`, `rm`, `mv`, `mkdir`, test runs, migrations, container/build commands. It has **no `Bash`** at all.
- ❌ Invoke an IMPLEMENTATION skill in-thread via `Skill` (`/tdd`, `/coverage`, `/architect`, `/adversarial-review`, or any router-matched implementation/domain skill). `Skill` runs in THIS conversation with THIS context and could edit files here — that violates the contract. **Delegate them through `Agent`.**
- ❌ Apply its own Kaizen edits directly — delegate to a `worker` (see Kaizen section).
- ❌ Commit or push without explicit user approval (see Critical Rules).
- ❌ Put the interactive/gated SPINE inside a `Workflow` call — see "Agent vs Workflow: HARD RULE" below for the full rule and which phases it covers.

**Why delegation, not main-thread skills**: a `Skill` invocation runs in the **main thread** (inherits this session's tools/context); an `Agent` (or `Workflow`-spawned agent) runs in a **separate session** with its own tools/context. All delegation modes guarantee "coordinator never touches files" — the worker does the editing in its own session and returns a result. This is also the **creator/verifier separation**: the agent that writes code is never the agent that validates it.

> If you ever feel the urge to "just make this one edit" — STOP. Dispatch a worker.

---

## ⛔ Critical Rules

**NEVER execute `git commit` or `git push` without explicit user approval.** Before ANY git op that modifies history/remote:
1. Show a summary of what will be committed/pushed.
2. Ask explicitly: "Ready to commit and push. Proceed? (y/n)"
3. **WAIT** for "y"/"yes".
4. Only then dispatch a worker to run the git commands.

Applies to ALL workflows, including Phase 4: Publish.

---

## External Research & Observability Tooling (Manual Only — never automated)

External research/observability tooling is manual-only, per `stack.md#observability`; never automate
it into the pipeline — every skill works without it, and skills degrade to "unverified" rather than
faking a check they can't run.

---

## Philosophy

> "Maximize parallelism, minimize wait time, ensure quality — by delegating, never doing."

This skill is the **default entry point** for any complex task. It intelligently selects skills and **dispatches them to subagents** based on task type. The coordinator reads, plans, gates, aggregates; the subagents do the work.

> **Triggering is not this skill's job.** Whether `/orchestrate` gets invoked at all — explicit
> command, skill-description auto-invoke, or the project's router/bootstrap — is decided before
> this body ever loads; a skill body only executes post-invocation, so it cannot gate its own
> triggering. See `description` (frontmatter, top of this file) and `CLAUDE.md`'s Skill Router.

---

## 📓 Orchestration Thread Log (ALWAYS — keep the thread)

The coordinator keeps `investigations/<TICKET>/orchestration-log.md` — so the thread survives compaction and any fresh session can resume without re-deriving. COMPLEMENTS the RPI artifacts (`understanding.md` / `<feature>-design.md` / `findings.md`); does not replace them.

**Two parts, in one file.** `## STATE` at the top — a ROLLING block, **overwritten in place** (not appended) at every phase boundary/gate: ticket + one-line task · current phase/gate · contracts C1..Cn with status/evidence level · open risks / pendientes / NEEDS_CONTEXT · next step. Below it, `## Ledger` — the append-only history entries. **Resume test:** *could a brand-new session read ONLY the STATE block and pick up exactly where we are?* STATE is the resume point; the ledger is audit trail, not the thing a fresh session must parse. (An audit of long-running orchestration logs found this test failing in practice: a perfect handoff checkpoint got buried well before the tail once later entries piled on top of it, and the largest logs accumulated dozens of `###` headings for a handful of real phase boundaries because agents split findings/steps into their own sections instead of bullets inside one entry. A rolling block can't be buried.)

**The coordinator never writes it itself** (no `Edit`/`Write`). Written by subagents:
- **Phases with a writing subagent** (a `worker` doing seed/TDD/quality): as its LAST step, appends its ledger entry AND overwrites STATE to reflect post-phase reality (the dispatch template's RETURN instructs both).
- **Boundaries with no writing subagent** (read-only `Explore` analysis phases; every GATE decision incl. the read-only `validator` gate): the coordinator dispatches a brief **micro-worker** ("append this entry + update STATE verbatim: …") (model: "haiku" — it's dictation). `Explore`/`validator` are read-only and cannot write.

**Read discipline**: dispatched agents read STATE + the last 2 ledger entries only — never the whole file. This caps the per-dispatch token cost regardless of how long the ledger grows.

**Cadence**: one ledger entry per PHASE boundary and per GATE — never per micro-action, never a raw tool dump.

**Ledger entry form (hard rules)**: ≤10 lines · exactly ONE `###` heading per entry — never nested sub-headings (multiple findings/steps become one bullet each inside the entry, not separate sections) · results as one-line bullets, no tool dumps, no prompt restatement, no play-by-play.

**Anti-absorption (RPI split)**: per-contract verdict tables, file-change tables, and finding write-ups belong in `findings.md` (or the design doc) — the ledger entry LINKS to them ("verdicts → findings.md §Slice-3"), never inlines them. If `findings.md` doesn't exist yet, the appending worker creates it rather than inlining tables into the log.

**Entry template** (append under `## Ledger`):
```markdown
### <Phase / Gate> — <one-line outcome>   (<phase id: 0a / 0b / 1A / 2.5-decompose / 2 / 3.5 / 3 / 4>)
- Dispatched: <subagent_type + skill> ×N
- Key results: <load-bearing facts / decisions + one-line why — link out to findings.md for tables/write-ups>
- Gate: PASS | FAIL — <reason>   (omit line if this boundary is not a gate)
- Open / next: <pending risk · NEEDS_CONTEXT · next phase>
```

The seeded log opens with an empty `## STATE` block above an empty `## Ledger`.

---

## 🗂️ Step 0: Check Investigations Folder (ALWAYS — Before Any Work)

BEFORE any ticket work (feature, fix, refactor), check for prior research: extract the ticket ID (branch or message, e.g. `PROJ-189`) and `ls investigations/<TICKET>/`.

**If folder exists** → **READ EVERYTHING IN IT FIRST** (canonical files per `/investigation`: `understanding.md`, `<feature>-design.md`, `tasks.md`, `findings.md`, `validation-contracts.md`, `orchestration-log.md`, plus any `seed_*`/`verify_*` scripts). Skipping this risks re-deriving research a prior session already produced — hours wasted redoing work that's already sitting on disk.

**If folder is empty/missing** → the coordinator does NOT create it (no mutating commands). The first dispatched **worker** seeds it by running `/investigation` (SEED mode) in its own session, then writes into the seeded files; the coordinator only reads them. RPI = Research / Plan / Implement ("No Vibes Allowed", Dex Horthy): legible intermediate artifacts, align on architecture **before** code. Worker's first action when empty:
```bash
# invoke Skill "/investigation" (mode SEED) — it creates investigations/<TICKET>/
# and understanding.md from investigations/_RPI-TEMPLATE.md with canonical naming
# STATUS: ACTIVE is pre-set at line 1; update to CLOSED when ticket is merged or parked.
# also seed orchestration-log.md with an empty `## STATE` block (ticket, task, contracts C1..Cn)
# above an empty `## Ledger`
```
> `tasks.md` is NOT pre-seeded here — the **architect emits it in Phase 0b** (see the Decompose row below), and only for non-trivial features/refactors. Trivial fixes skip it.

**RPI → phase mapping** (seeded artifacts feed the pipeline):

| RPI phase | Seeded artifact | Drives orchestrate phase |
|---|---|---|
| **Research** | `understanding.md` | Phase 0b `/architect` (+ `Explore`) — system map, write-paths, live-data grounding |
| **Plan** | `<feature>-design.md` (ADR) | Phase 0b `/architect` (+ router-matched skills for schema/perf, if present) — files+lines, test strategy, alternatives |
| **Decompose** (non-trivial only) | `tasks.md` | Phase 0b `/architect` emits it (extends the ADR Implementation Plan) → **Gate 2.5** verifies → Phase 2 `/tdd` walks it. Ordered checklist, **1 task = 1 testable behavior = 1 RED→GREEN cycle**, each mapped to a contract (C1..Cn) + naming file & test. Lives at `investigations/<TICKET>/tasks.md` (gitignored). **If OpenSpec is used, its committed `tasks.md` IS the artifact — do not create the RPI one.** |
| **Implement** | code + `seed_*`/`verify_*` scripts + `findings.md` | Phase 2 `/tdd` → Gate 3.5 validator — RED/GREEN/REFACTOR, residual risk |

The **grill-me** contracts (Phase 0a) belong in `validation-contracts.md` (→ the Plan's "Test strategy" row). Heavier features (>1 day, customer-facing, multiple stakeholders, compliance-sensitive, needs session handoff) → promote Plan into OpenSpec (`/opsx:new`) per `CLAUDE.md`'s OpenSpec decision rule. **Zero cost** if empty (one `cp`); **huge save** if research exists.

---

## Available Skills & Execution Rules

> The full per-phase skill catalog, the parallel-execution rules, the sequential-dependency table, and the context-aware selection tables live in **`reference/workflows.md`**.
> The pipeline shape (which phases fan out in parallel vs gate serially) lives in **`reference/dependency-graph.md`**; per-phase subagent type + pinned model is in the "Phase → subagent_type" table below.
> **Glob→skill routing is canonical in `CLAUDE.md`'s Skill Router (auto-invoke tier + per-file/glob triggers)** — `worker`/`validator` agents auto-load it; the coordinator must consult it when composing every dispatch prompt. Not duplicated here.

**Execution-locus shorthand** (which agent runs a skill): 🟣 coordinator-direct = `/grill-me`, `/brainstorm`, `/learning` · 🟢 worker (edits) = `/tdd`, `/coverage`, `/commit`, `/create-pr`, plus any router-matched implementation skill · 🔵 validator = `/adversarial-review`, or the router-matched review skill if present · 🔎 Explore (read-only) = the analyst skills registered in `stack.md#analysts` plus router-matched skills from `CLAUDE.md`; if none exist, dispatch `Explore` agents directly for the pattern-scan.

---

## Delegation Protocol (HOW the coordinator dispatches)

Every phase is a subagent dispatch via `Agent`. The coordinator composes the prompt, launches the agent(s), gates on the returned result.

> **Tool naming**: the primitive is the **`Agent`** tool with a `subagent_type` arg. Older docs say "Task tool" — same thing.
> **Effectively one level deep here**: nesting subagents IS supported by the harness (when an agent is granted the `Agent` tool, up to depth 5), but our dispatched agents (worker/validator/architect/Explore) are NOT granted `Agent`, so in this setup they cannot spawn further subagents; and `AskUserQuestion` is never available inside any subagent (harness restriction). Consequences: grill-me is coordinator-direct; `code-simplifier` is a coordinator-dispatched phase (a worker can't call it).
> **Separate context windows**: each subagent runs in its OWN context (it does NOT see this conversation; only its final result returns). Every dispatch prompt must be **self-contained**. Caveat: **`worker`/`validator` auto-load `CLAUDE.md` + `CLAUDE.local.md`** (conventions + Skill Router already present), but **`Explore` skips them** — so an `Explore` prompt must explicitly name the skill/convention to apply.

### Dispatch mode: three primitives

**Default = foreground `Agent`.** Dispatch every phase in the foreground. Foreground is already parallel — launch N independent agents as **multiple `Agent` calls in ONE message** (e.g. the read-only analysts of Phase 1A). Foreground agents render inline (`ctrl+o` to expand) and return synchronously, keeping every **gate trivial and reliable** — exactly what the dependency chain (grill → architect → impl → validator → quality) needs.

**Escalate to background `Agent`** (`run_in_background: true`, or `ctrl+b` on a running one) ONLY when: (1) a worker is expected to be **long** (large slice), or (2) **fan-out across multiple independent surfaces** (vertical-slice DAG) you want on the dashboard.

**Use `Workflow` for STATELESS FAN-OUT** phases — entirely headless + stateless (parallel read-only analysis 1A/1B, parallel quality 3, adversarial find→verify). It provides deterministic execution, journaled crash-resume, schema-validated structured output, and a concurrency cap. NOT mandatory — use `Agent` when fan-out is small or you want inline visibility; use `Workflow` when fan-out is large enough that journaling + structured output pay off.

**NEVER put the interactive/gated SPINE into a `Workflow`** — see "Agent vs Workflow: HARD RULE" below.

> Foreground subagents are NOT missing — they render inline ("Running N agents…"); they just don't show in the cross-session jobs dashboard unless backgrounded.

### Phase → subagent_type

| Phase | What runs | `subagent_type` | Model | Mode | Workflow-eligible? |
|-------|-----------|-----------------|-------|------|--------------------|
| 0 Ideation (unformed) | `/brainstorm` diverge → pick direction | **coordinator-direct** (`Skill` + `AskUserQuestion`) | session model | serial, interactive | ❌ needs `AskUserQuestion` |
| 0a Grill (fuzzy) | `/grill-me` → contracts | **coordinator-direct** (`Skill` + `AskUserQuestion`) | session model | serial, interactive | ❌ needs `AskUserQuestion` |
| 0b Architecture | `/architect` design + location **(+ emits `tasks.md` for non-trivial work)** | **`architect`** | opus (pinned — planning is the quality phase) | serial, **fg** | ❌ serial, gated |
| 1A/1B Analysis | analyst skills from `stack.md#analysts` + router-matched skills from `CLAUDE.md`; else `Explore` directly | `Explore` (read-only) | `model: "sonnet"` (pattern-scan) | **parallel fg** | ✅ delegate to `Workflow` when fan-out ≥ 4 + journaled output worthwhile |
| 2 Implementation | `/tdd` RED→GREEN→REFACTOR | **`worker`** | sonnet (pinned per `.claude/agents/worker.md`); **escalate to `opus`** after 2 validator REQUEST CHANGES on same contract | serial, **fg** (→ bg if long / multi-surface) | ❌ serial, gated by 3.5 |
| 3.5 Validator GATE | `/adversarial-review`, or the router-matched review skill if present, vs contracts | **`validator`** (≠ worker session) | opus (pinned — adversarial verification = highest-leverage spend) | serial, **blocking, fg** | ❌ blocking gate |
| 3 Quality | coverage (owns test files) · lint (`stack.md#commands`) — read-only report; its fixes belong to the code-simplifier · code-simplifier (owns changed production files, incl. their lint autofix) · plus any router-matched quality skill | `worker` (edits) / `Explore` (read-only) | sonnet | **parallel fg** | ✅ structured aggregation + journaled resume |
| 4 Publish | commit → PR (`/commit` → `/create-pr`); for non-trivial diffs, SUGGEST `/thermo-review` (structural gate, manual-only) before `/create-pr` | **`worker`**, only after `y/n` | sonnet | serial, **fg** | ❌ gated on user `y/n` |

> **Adversarial find→verify pipeline**: each `/adversarial-review` lens is stateless + headless → ✅ Workflow-eligible; the coordinator still reads the aggregated verdict before gating.
> **Skill Router coupling inside Workflow agents**: per-agent prompts written into a workflow script MUST still name the mandatory skills from `CLAUDE.md`'s Skill Router matching the globs/packs they touch — same rule as plain `Agent` dispatch.
> **Model routing — model follows the TASK NATURE, not the subagent_type.** Pattern-scan (grep-shaped analyst checks) → sonnet. Reasoning-heavy (design, adversarial failure construction, contract verification) → opus. Same `Explore` type runs sonnet for 1A scans but opus for `/adversarial-review` lenses. Worker escalation: validator REQUEST CHANGES twice on one contract → re-dispatch worker with `model: "opus"`. Mechanical micro-worker dispatches (verbatim orchestration-log/Kaizen appends, file copies, seed `cp`s — dictation, not reasoning) → dispatch with `model: "haiku"`; anything requiring judgment stays on the default tier.
> **Sonnet-tier pin**: `worker` and `code-simplifier` pin their model directly in their own agent frontmatter — see the worker's model pin (`.claude/agents/worker.md`). Inline `model: "sonnet"` dispatches (1A/1B `Explore` analysts, Phase 3 quality) resolve to the session's configured sonnet tier. This does not change the user's default session model.
> **Dispatch label convention:** prefix every `Agent` `description` with the role emoji and suffix the model tier, so the status line shows role + model at a glance. Format: `EMOJI role: short task · model`. Emojis: 🏛️ architect · 🛠️ worker · 🕵️ validator · ✨ code-simplifier · 🔍 Explore. (There is no native subagent emoji frontmatter field in Claude Code — `color` only; the invocation `description` is where a per-call emoji renders.)

**code-simplifier**: a coordinator-dispatched phase (`Agent subagent_type="code-simplifier"`) after the worker / during Quality — NOT worker-triggered (workers can't spawn subagents). Optimize test files after TDD; production code during Quality.

### Reusable dispatch template

```
Agent — subagent_type: "<architect | worker | validator | Explore>"
prompt:
  ROLE: <Worker | Validator | Analyst> for <phase>.
  TASK: <one-sentence goal>.
  MODEL: <pin per the Phase → subagent_type table — REQUIRED in every dispatch; state it
    explicitly, never leave it implicit>.
  SKILL TO FOLLOW: follow `/<skill>` end to end (read its SKILL.md first) — the matching project
    skill if one exists (CLAUDE.md skill router / stack.md#analysts), else proceed manually.
    Apply CLAUDE.md conventions (CLAUDE.local.md overrides where present) and commands per
    stack.md#commands (test conventions, forbidden patterns).
  CONTEXT:
    - Ticket / scope: …
    - Validation contracts (MUST hold): C1…Cn — read them at
      investigations/<TICKET>/validation-contracts.md (do NOT paste them into this prompt).
    - Relevant files / globs: …
    - Prior research (read by REFERENCE, not pasted): the design doc
      investigations/<TICKET>/<feature>-design.md (relevant section only) + orchestration-log.md
      — read ONLY the ## STATE block and the last 2 ledger entries, never the whole file.
    - Diff scope (review): per `../shared/diff-scope.md`, variant `content` — the work is NOT committed
      at gate time, so scope from the merge base to the working tree and enumerate untracked files.
  CONSTRAINTS:
    - Architect (non-trivial feature/refactor only): as part of the ADR, also emit `investigations/<TICKET>/tasks.md` — an ordered checkbox list where each task = ONE testable behavior = ONE RED→GREEN cycle, each naming the file + test and the contract(s) C1..Cn it satisfies. Trivial single-behavior work → do NOT emit it. If OpenSpec is in use, its committed `tasks.md` IS the artifact; do not create a second one.
    - Worker: implement only what the contracts require; tests FIRST (RED→GREEN). If `tasks.md` exists, walk it ONE RED→GREEN cycle per task, checking each off as its test goes green.
    - Worker: Contract IDs (C1..Cn) and the ticket ID are SESSION ARTIFACTS — never emit them into committed code, test descriptions, or comments (see `../shared/forbidden-patterns.md`); the contract→spec mapping goes in your RETURN, not the code.
    - Any WRITER dispatched in a parallel batch: WRITE SET — you may create or modify only <explicit paths/globs>. Every other path is read-only for you. If a change you need falls outside it, STOP and report it as a cross-boundary edit; do not make it.
    - Validator: you did NOT write this code; try to BREAK it; per contract assign an **evidence level** from the ladder (`behavior-verified` › `test-verified` › `static-only` › `blocked` › `failed`) + evidence.
  RETURN (LEAN by default): one line per PASSING contract; full evidence ONLY for failures/concerns. Structured: what you did/found by file · per-contract PASS/FAIL · test/lint/coverage · open risks · STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT.
    - Validator RETURN additionally: per-contract **evidence level** (the 5-rung ladder defined canonically in `.claude/agents/validator.md`: `behavior-verified`›`test-verified`›`static-only`›`blocked`›`failed` — claim only the level your evidence supports; `blocked` is never disguised as `static-only`; re-derive every level yourself, never inherit the worker's self-report) + `ruled_out` (concern + guarding mechanism) + `uncertain` (open question + why) + a **Design Coherence** table when an ADR exists (each design decision → followed? yes/no + note).
    - NEEDS_CONTEXT: subagent hit genuine ambiguity it CANNOT resolve alone (no AskUserQuestion inside a subagent — one level deep). Coordinator answers and re-dispatches rather than the worker guessing.
    - THREAD LOG: as your FINAL step, append a ledger entry (≤10 lines, ONE `###` heading, one-line bullets — Phase/Gate · dispatched · key results · gate verdict · open/next) to `investigations/<TICKET>/orchestration-log.md` under `## Ledger`, AND overwrite the `## STATE` block above it to reflect post-phase reality. Tables/write-ups go in `findings.md` (create it if missing) — link them from the entry, never inline them. (Read-only Explore/validator agents cannot write; the coordinator dispatches a micro-worker for those boundaries.)
```

> **Before composing any prompt**, consult `CLAUDE.md`'s Skill Router (auto-invoke tier + per-file/glob triggers) and name every mandatory skill matching the globs/packs the subagent will touch.

---

## Agent vs Workflow: HARD RULE

Two delegation primitives. The interactive/gated SPINE always uses `Agent` (foreground); stateless fan-out phases may use either, with `Workflow` preferable as fan-out grows.

| Dimension | Model-driven `Agent` | Deterministic `Workflow` |
|-----------|----------------------|--------------------------|
| Execution | Free-form reasoning | JS script: `phase()`, `agent()`, `parallel()`, loops |
| Output | Free-text (coordinator parses) | Schema-validated structured |
| Resume on crash | None — re-dispatch | Journaled — resumes from last phase |
| Human input mid-run | Via `AskUserQuestion` | ❌ IMPOSSIBLE — headless |
| Concurrency cap | Manual batch size | Built-in |
| Best for | Any phase; esp. interactive/gated | Stateless fan-out, many parallel agents |

### HARD RULE — the interactive spine NEVER runs inside a Workflow

These MUST stay in the coordinator's foreground as plain `Agent`/`Skill` calls — never a `Workflow`:
- **Phase 0a `/grill-me`** — needs `AskUserQuestion` to interrogate until ambiguity = 0; headless would silently skip the interview.
- **Gate 3.5 Validator** — the coordinator must read the validator's verdict (per-contract evidence levels + APPROVE/REQUEST CHANGES) synchronously before looping or advancing; a headless pipeline can't gate on coordinator judgment.
- **Phase 4 Publish y/n** — needs explicit user approval before any git op; a headless background Workflow could never wait for it.

Violating this silently drops human-oversight checks — the most dangerous failure mode for a pure coordinator.

**Delegate to `Workflow` only when ALL hold**: (1) **stateless** (no `AskUserQuestion` within the run), (2) **headless** (read-only analysts or quality workers, no human decision to block on), (3) **fan-out benefit** (≥ 4 independent parallel agents AND structured/journaled output clearly pays off). If any fails, keep the phase as a batch of foreground `Agent` calls. Eligible phases: 1A/1B Analysis, 3 Quality, adversarial find→verify. (Skill Router coupling inside the workflow script is unchanged — per-agent prompts still name every mandatory skill.)

---

## Orchestration Workflows

> All workflows run through the Delegation Protocol — the bullets name *what* runs per phase; the coordinator executes each as an `Agent` dispatch (read-only → `Explore`; implementation → `worker`; verification → `validator`), never in-thread. **Code-producing** workflows (1 Feature, 2 Bug Fix, 3 Migration, 7 Refactor, 8 Performance, 9 Security Hardening) imply two phases: **Phase 0a `/grill-me`** if the spec is fuzzy, and the blocking **Validator gate (3.5)** between implementation and quality. Read-only workflows (4 Debug, 5 Adversarial Review, 6 Pre-commit, 7's coverage sibling) skip the validator gate unless they produce a code change.

Each workflow is a **named entry point** selecting a starting subset of phases from the pipeline shape (`reference/dependency-graph.md`); per-phase subagent/model detail is in `reference/workflows.md`. One line per workflow:

- **1. Feature** (`/orchestrate feature`) — grill-me → architect → 1A/1B → **decompose (`tasks.md`, Gate 2.5)** → TDD → **validator gate** → quality → publish (full pipeline).
- **2. Bug Fix** (`/orchestrate fix <issue>`) — root-cause investigation first (Explore, or the router-matched debug skill if present) → domain checks → TDD (failing test reproducing the bug first) → **validator gate** → quality.
- **3. Migration** (`/orchestrate migration`) — architect reviews safety/rollback/index strategy → parallel analysis (router-matched skills if present, else `Explore`) → TDD up/down. No publish implied; gate if it produces code.
- **4. Debug** (`/orchestrate debug <error>`) — parallel context-gather (observability oracle per `stack.md#observability` + code search) → root-cause → reproduction script → report. **Read-only: no validator gate** unless it produces a fix.
- **5. Adversarial Review** (`/orchestrate code-review`) — parallel 1A → parallel 1B → deep `/adversarial-review` + code-simplifier. **Read-only through 1B; the code-simplifier WRITES — if it returns any edited file, that is a code change and the validator gate (3.5) applies per the code-producing rule above.**
- **6. Pre-Commit** (`/orchestrate pre-commit`) — parallel checks (tests/coverage/lint per `stack.md#commands` via worker; router-matched analysts via Explore) → **GATE: all-pass → y/n → worker commits; any fail → STOP.**
- **7. Coverage** (`/orchestrate coverage`) — `/coverage` finds uncovered → up to 3 parallel spec-writing workers (write→validate→run per file — one spec file per worker, disjoint write sets; shared fixtures/factories go to a serial integrator pass) → verify 100%. **No validator gate.**
- **8. Refactor** (`/orchestrate refactor`) — parallel analysis (router-matched skills if present, else `Explore`) → architect plans → **decompose (`tasks.md`, Gate 2.5)** → TDD (add tests → refactor → stay green) → **validator gate** → quality.
- **9. Performance** (`/orchestrate performance-optimize`) — parallel performance analysis (router-matched skill if present, else `Explore` + observability oracle per `stack.md#observability`) → prioritize by impact → TDD benchmark tests → **validator gate** → re-verify.
- **10. Security Hardening** (`/orchestrate security-hardening`) — parallel security analysis (router-matched skill if present, else `Explore`) → production verification (manual observability-oracle data-exposure check per `stack.md#observability`) → TDD security tests → **validator gate** → re-run security + final review.
- **11. Kaizen** (`/orchestrate kaizen` or `/kaizen`) — 5-phase skill-maintenance loop: Analyze → Evaluate → Improve → Validate → Document. Manual only; coordinator delegates the actual edits to a worker (see Kaizen section).
- **Domain workflows**: compose from the router + `stack.md#analysts` per project — a project-specific workflow (e.g. a payments/compliance/API pipeline) is just a named selection of the same phases above with its own router-matched skills swapped in.

> **Parallel = multiple `Agent` calls in one batch** (one message, multiple tool uses) so they run concurrently. See the dispatch template above.

> **Parallel writers — declare the write sets, then verify them.** Before dispatching 2+ WRITERS in
> one batch (Phase 3 Quality, Workflow 7's spec workers), give each a WRITE SET in its CONSTRAINTS
> and confirm the sets are pairwise **disjoint**. Read-only agents (`Explore`, `validator`) need no
> write set — they cannot collide, and giving them one is noise. Two writers that genuinely need the
> same file: do NOT split the file — either serialize them over it, or make one the sole owner and
> have the other **report** its change as a cross-boundary edit for the owner to apply. Shared seams
> (fixtures/factories/support files, shared config) belong to no parallel writer: assign them to a
> single serial integrator pass. **On return, check each writer's RETURN item 1 (files changed) is a
> subset of its write set — a file outside it fails the phase; it is not a note.** A batch of
> parallel writers with no declared write sets is not dispatchable: declare them, or serialize.

> **Parallel executors — source isolation is not resource isolation.** A disjoint write set keeps two
> agents off each other's *files*; identity has a second axis, the **runtime slot** they execute in.
> Before dispatching 2+ agents that will RUN anything (test suite, build, local environment), list the
> shared runtime resources they would contend for per `stack.md#test-conventions` (parallel-safety
> rules) and `stack.md#commands` (establishing local state); if either is TODO, ask — do not assume
> there are none. The read-only exemption above does NOT carry: an `Explore` that runs the suite
> contends exactly like a writer. Per contended resource, pick one — give each agent a **distinct
> identity** for it (own instance, namespace, or directory), **serialize** them over it, or make one
> the **sole owner** and have the others skip that step and report. Same workspace *and* same slot is
> one agent, not two: unpartitioned contention is not dispatchable — isolate it, or serialize.

---

## Phase Gates (CHECKLIST — pass criteria are blocking)

Run each gate in order. A gate's **Fail** branch is mandatory — do not advance until **Pass**.

- [ ] **Gate 0 — Ideation** (Phase 0, unformed specs only; ran `/brainstorm`).
  - **Pass**: a single direction chosen (rejected alternatives + why noted); any multi-subsystem request decomposed.
  - **Fail**: keep diverging/decomposing — do NOT dispatch grill-me with the option space open.
  - **Skip**: approach already known → go to Gate 0a.
- [ ] **Gate 0a — Grill** (Phase 0a, fuzzy specs only; ran `/grill-me`).
  - **Pass**: ambiguity = 0 AND validation contracts C1..Cn emitted and confirmed by the user.
  - **Fail**: keep grilling — do NOT dispatch architect/worker with unresolved branches.
- [ ] **Gate 1 — Static Analysis** (Phase 1A; all Explore analysts returned).
  - **Pass**: no critical violations per the router-matched/stack.md#analysts checks that ran.
  - **Fail**: STOP and report violations.
- [ ] **Gate 2 — Domain Analysis** (Phase 1B; domain analysts returned).
  - **Pass**: domain invariants validated (e.g. data isolation, compliance rules — whichever apply per stack.md#analysts).
  - **Fail**: STOP on domain violations.
- [ ] **Gate 2.5 — Decompose** (between Phase 1B and Phase 2; the architect emitted `investigations/<TICKET>/tasks.md`). Coordinator reads it (reading is allowed — no worker needed to verify).
  - **Pass**: `tasks.md` exists and is ordered; every task is ONE testable behavior mapped to ≥1 contract (C1..Cn), names its file + test, and is no larger than a single RED→GREEN cycle.
  - **Fail**: a task is oversized, unmapped to a contract, or missing file/test → re-dispatch the `architect` to re-decompose (do NOT let the worker start on a bad breakdown).
  - **Skip**: trivial bug fix / single-behavior change → no `tasks.md`; the one TDD RED→GREEN cycle IS the micro-task. (Same complexity gate as Gate 0's Skip and the OpenSpec promotion gate.)
- [ ] **Gate 3 — TDD** (Phase 2; `worker` reported complete).
  - **Pass**: tests green, code implemented in the worker's session.
  - **Fail**: re-dispatch worker with the failure.
- [ ] **Gate 3.5 — VALIDATOR** (Phase 3.5 — **BLOCKING, independent agent ≠ worker**; verified the diff vs contracts).
  - **Pass**: every contract C1..Cn reaches `test-verified`+ (or a justified `static-only` for an inherently-static, grep-checkable contract) with evidence; `blocked`, `failed`, or a behavioral contract resting on `static-only` all fail the gate — except a hand-off-executable contract, whose floor is raised to `behavior-verified` per `.claude/agents/validator.md`'s evidence ladder (the source of truth for grading rules; not restated here); verdict APPROVE / APPROVE WITH NOTES.
  - **Fail (REQUEST CHANGES)**: loop back to a **fresh** `worker` with the findings, then re-run a **fresh** `validator`. Never let the worker self-verify. Quality does not start until this passes.
- [ ] **Gate 4 — Code Validation** (Phase 2.5; implementation-detail analysts returned).
  - **Pass**: patterns correct per the router-matched implementation-detail analysts that ran (or, absent any, per manual review against stack.md#analysts).
  - **Fail**: re-dispatch worker to fix; re-run validator if behavior changed.
- [ ] **Gate 5 — Quality** (Phase 3; **precondition: Gate 3.5 passed**). REQUIRED CHECKS, each a dispatched subagent:
  - Tests: all specs passing (`stack.md#commands`) · Coverage: 100% on changed lines (patch) · Coverage: global % not decreased · Lint: no violations on changed lines (`stack.md#commands`) · Domain: relevant router-matched analysts passed · Comments: [Comment Discipline](../shared/comment-discipline.md), ratio reported · Simplicity/YAGNI: no unrequested params, features, or speculative abstractions — only what a contract (C1..Cn) requires (dispatched via the code-simplifier phase).
    **Ordering**: these checks run only AFTER every Phase-3 writer has returned (notably the code-simplifier). A suite that finished before the last edit landed is a stale run and grades `static-only` (`.claude/agents/validator.md`) — re-run it.
  - **Fail (any)**: report all failures → re-dispatch a worker to fix → re-run failed checks (and validator if behavior changed) → DO NOT proceed to publish.
  - **Pass (all)**: ask the user "Ready to commit and push? Comment ratio (after edit): <N>%. (y/n)", filling `<N>` with the Comments check's own reported after-edit ratio, or `N/A` when the diff adds no code (docs/config-only) → wait for explicit approval → dispatch a worker to run commit→PR (coordinator runs no git).
- [ ] **Gate 6 — Publish** (Phase 4; only after all gates pass AND user approved `y/n`).
  - **Pass**: worker created commit + PR; returns SHA + PR URL.

> **Status-tracking report format + an end-to-end example session** → `examples.md`.

---

## Best Practices

1. **Never do the work — dispatch it**: read, plan, gate, aggregate. Edits/tests/commits happen in subagent sessions only.
2. **Separate creator from verifier**: the `validator` is always a different session than the `worker`. On a re-loop, both are fresh sessions.
3. **Maximize parallelism**: launch independent analysts as one batch of `Agent` calls.
4. **Fail fast**: stop at the first critical gate failure; re-dispatch a worker rather than patching in-thread.
5. **Clear dependencies**: never parallelize dependent phases (grill → architect → impl → validator → quality).
6. **Name the skills**: every dispatch prompt names the skill(s) + the validation contracts + the Skill Router matches.
7. **Report clearly**: summarize what was dispatched and what each subagent returned at each phase.
8. **Verify once per phase, not once per worker**: gates own the aggregates (full suites, full audit) — see `kaizen_log.md`'s 2026-07-10 efficiency-doctrine entry.

---

## Meta-Skills (Manual Only)

`/kaizen`, `/skill-creator`, `/optimize-skill`, and `/qa-audit` are **manual only** — no automatic triggers. Use `/skill-creator` on repeated manual work (3+ times same pattern on real code) worth automating; `/optimize-skill` to tighten an existing skill; `/qa-audit` after adding or removing a skill; `/kaizen <skill-name>` (or `/kaizen` for a full audit) when a skill fails repeatedly, could be more efficient, or has unclear docs. No overhead — the user decides when to analyze. (Glob→skill routing remains canonical in `CLAUDE.md`'s Skill Router — auto-invoke tier + per-file/glob triggers.)

---

## Kaizen: Continuous Improvement

> "Every day we must improve" — 改善

**While executing this skill**, if you discover a new parallel-execution opportunity, a missing dependency, or a better workflow — **you MUST** (the coordinator cannot edit files; it delegates its own Kaizen edits):
1. Complete the current orchestration first.
2. Draft the Kaizen entry text (format: `<!-- Kaizen: YYYY-MM-DD --> …`).
3. Dispatch a worker: `Agent subagent_type="worker"`, prompt: "Append this Kaizen entry verbatim to `.claude/skills/orchestrate/kaizen_log.md` (do not modify anything else):\n<entry>".
4. Confirm the worker reported success.
