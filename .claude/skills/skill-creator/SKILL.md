---
name: skill-creator
description: Detects skill gaps in the ecosystem and semi-automatically forges new skills from proven, repetitive manual work on real code. Use after a session where you did the same multi-step task 3+ times on implemented code (not exploration/planning/prototypes) and want to automate it.
allowed-tools: [Read, Grep, Glob, Edit, Write]
disable-model-invocation: true
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Skill Creator - Detect Gaps & Forge New Skills

> "Create skills from patterns, not guesswork" - 鍛造 (Tanzo - Forging)

## Purpose

Systematically detect skill gaps by analyzing session patterns, then semi-automatically create new skills when repetitive manual work on real, implemented code is identified. Keeps the skill ecosystem evolving from actual usage, not theoretical requirements.

## Philosophy

> "The best skills come from solving the same problem three times."

**1st time**: manual exploration (learn the problem). **2nd time**: documented approach (understand the pattern). **3rd time**: create a skill (automate the solution). Skills emerge organically from real needs.

## Core Principles

1. **Pattern-Driven** — only proven, repetitive patterns
2. **Data-Based** — analyze actual session data, not assumptions
3. **Semi-Automatic** — detect + suggest, but user approves
4. **Quality-First** — generated skills follow ecosystem standards
5. **Single Responsibility** — each skill solves one problem
6. **ROI-Focused** — create only if time saved > maintenance cost
7. **🔴 Implementation-Only** — only **implemented** patterns, never explorations or future ideas
8. **🔴 Absolute over permissive language.** Write rules as bright lines (MUST / NEVER / "no exceptions"), never hedges ("consider… when feasible"). Measured by obra/superpowers: compliance ~doubles when permissive phrasing is replaced with absolutes, because a bright line removes the "is this an exception?" gap where discipline erodes under pressure.

## When to Use

**Manual only — user decides.** Invoke after a session where you notice: repetitive manual work (same thing 3+ times); a clever solution worth automating; a workaround for a skill failure; or a pattern that could help future sessions.

```bash
/skill-creator               # Analyze current session
/skill-creator analyze       # Deep analysis of last 10 sessions
/skill-creator suggest       # Show candidate skills (no creation)
/skill-creator create <name> # Create skill from approved proposal
/skill-creator metrics       # Show skill creation opportunities
```

- ✅ "Validated RBAC manually 3 times" → invoke
- ✅ "Fixed similar N+1 in 3 controllers" → invoke
- ✅ "Found pattern in gateway comparison" → invoke
- ❌ "Quick bug fix in 1 file" → don't (too simple)

## Detection Algorithm (Scoring)

Pre-filter: **implemented code only** — `:ignore` exploration/planning, future features, prototypes. Then score frequency + complexity + standardization + value + implementation. Thresholds:

- **≥ 8** → `:create_skill` (strong candidate)
- **5–7** → `:monitor` (watch for more occurrences)
- **< 5** → `:ignore` (not worth automating)

→ Full Ruby `skill_candidate?` scoring block: [reference/scoring-algorithm.md](reference/scoring-algorithm.md)

## Pattern Detection (5 Types)

| Type | Signal |
|------|--------|
| 1. Repetitive Grep + Read | Same grep → read same files → extract info, repeated 3+ times |
| 2. Manual Agent invocations | Same `Explore` "find all X, check Y" prompt 3+ times |
| 3. Multi-Validator sequences | Same ordered `/v1 → /v2 → /v3` run repeatedly (could parallelize) |
| 4. Complex Manual Analysis | Prod metrics → cross-ref code → root cause → fix, repeated |
| 5. Documentation Generation | Analyze structure → diagram → docs, same format each time |

→ Signals + example candidates per type: [reference/pattern-types.md](reference/pattern-types.md)

## Workflow: Skill Creation (6 Phases)

1. **Detect** — scan transcript, extract repeated workflows, count occurrences, score (0–10)
2. **Analyze** — check existing-skill overlap, verify ≥80% consistency, estimate ROI, filter score ≥ 8
3. **Propose** — generate proposal doc (name, workflow, ROI, before/after), present to user
4. **Approve** — user decides: ✅ approve / ⏸️ defer (backlog) / ❌ reject (document why)
5. **Generate** — create `.claude/skills/<name>/SKILL.md` from template, seed `kaizen_log.md`
6. **Validate** — frontmatter valid, tools exist, conventions met, **behavior-tested** (≥1 RED + ≥1 GREEN + ≥1 combined-pressure), then chain `/optimize-skill`
   - **Closing step — WIRE it, or it never fires.** A validated-but-unrouted skill is orphaned: it passes every gate and no trigger points at it. Append its row to the `CLAUDE.md` Skill Router (or `CLAUDE.local.md` where the project uses one), wire its entry points (orchestrate Step 0, per-file/glob rows), then `grep` the router to confirm the row landed. Phase 6 is not complete until that grep succeeds.

→ Full ASCII workflow box with per-phase detail: [reference/workflow-phases.md](reference/workflow-phases.md)

## Templates

→ All copy-paste templates live in [reference/templates.md](reference/templates.md):
- **Proposal Format** — what to present when a candidate is detected
- **Skill Template Generation** — the `SKILL.md` scaffold the generator emits (frontmatter spec notes + optional epigraph/Philosophy + `kaizen_log.md` pointer)
- **Creation-Log Template** — entry shape for `creation_log.md`
- **Deferred Backlog Format** — monitoring / deferred / rejected tracking
- **Output / Detection-Report Format** — the session opportunities report

## Integration with Orchestrator

> **NOT IMPLEMENTED** — skill-creator is **manual-only**, with zero automatic triggers. No session hook or cron fires it.

→ Aspirational end-of-session / weekly-aggregation pseudocode (reference only): [reference/aspirational-integration.md](reference/aspirational-integration.md)

## Metrics & Tracking

Record every detection/decision in [`creation_log.md`](creation_log.md) (entry shape in the Creation-Log Template within [reference/templates.md](reference/templates.md)).

## Frontmatter Rule: `description:` States What + When (not a Step Sequence)

When authoring or editing a skill's YAML frontmatter:

**Rule**: `description:` must state, in third person, **WHAT the skill does AND WHEN to use it** (concrete triggering conditions), and must stay **under a 200-word budget**. This aligns with the Anthropic Agent Skills spec, where `description` is the field that tells the agent both the capability and when to apply it.

**Real failure-mode to avoid**: do **not** encode a step/phase **SEQUENCE** in the description that an agent could follow in lieu of reading the body. When the description spells out an ordered workflow, the agent may follow the description verbatim and skip the body. A description that summarized "code review between tasks" caused ONE review where the body's flowchart required TWO; removing the workflow summary made the agent read the flowchart and comply. State the what+when; keep the *how* (ordered steps/phases) in the body only.

```yaml
# ❌ BAD: encodes an ordered sequence — agent follows this, skips the body
description: Use when repetitive work detected — scan sessions, score patterns, propose, get approval, generate

# ✅ GOOD: states what it does AND when to use it, no followable step sequence
description: Detects skill gaps and forges new skills from repetitive manual work on real code. Use after doing the same multi-step task 3+ times on implemented code.
```

**Frontmatter spec note**: the Anthropic spec only REQUIRES `name` + `description`. `allowed-tools` is optional; `disable-model-invocation` is a Claude-Code harness extension (not in the Anthropic Skills spec). Keep using them here (valid in this harness) — just don't present them as universally required.

**Checklist addition** — before Phase 6 (Validate), confirm:
- [ ] `description:` states WHAT the skill does AND WHEN to use it (third person)
- [ ] `description:` contains NO followable step/phase SEQUENCE (no ordered workflow)
- [ ] description is < 200 words
- [ ] The ordered workflow/steps live exclusively in the skill body

## Pressure-Test Before Ship (TDD for Skills)

The Iron Law (from obra/superpowers writing-skills, MIT): **NO SKILL WITHOUT A FAILING TEST FIRST.** Applies to new skills AND edits. A skill written without a baseline test is deployed untested code — the same reason a behavioral code fix always starts from a failing test before the fix lands.

- **RED — baseline (without skill)**: dispatch a fresh subagent (`subagent_type: general-purpose`) with a realistic scenario where the skill SHOULD change behavior, but do NOT mention the skill. Document verbatim: choices made, rationalizations, which pressures triggered the violation.
- **GREEN — with skill**: re-run the same scenario WITH the skill content available. The agent must now behave per the skill. If it still fails, revise and re-test.
- **Pressure variants**: re-run GREEN under combined pressures (time, sunk cost, authority, economic, exhaustion, social, pragmatic). Best tests combine 3+.
- **Documented-baseline form**: an authoring session that cannot spawn subagents (a worker) records the test as a written scenario walk in a `pressure-test.md` under the skill's own reference directory instead — the RED baseline (what a skill-less agent does under the trigger prompt) and the GREEN trace (which exact lines of `SKILL.md` block each step of that baseline). It is the initial baseline, not a substitute for the live-subagent RED/GREEN run, which belongs to the validator/coordinator.

**Rationalization table** — the explicit OUTPUT artifact of the RED step: capture every rationalization the agent voiced under pressure, paired with the counter to bake into the skill body.

| Rationalization the agent voices under pressure | Pre-loaded counter to bake into the skill |
|---|---|
| "This is just a simple question, I'll skip the skill." | Simple is exactly when the skill is cheapest to run. |
| "I'll explore first, then check the skill." | Checking the skill first IS the exploration. |
| "This one time doesn't count, I'm under deadline pressure." | No exceptions — the pressure is the test, not an excuse to skip it. |

**Acceptance rule** — a skill is NOT done until: ≥1 RED documented + ≥1 GREEN documented + GREEN holds under ≥1 combined-pressure scenario. Document in the skill's `kaizen_log.md` or `investigations/`. Undocumented = untested = not done. **No exceptions** (not for "simple additions", not for "just adding a section"). The bench is Agent-tool subagent dispatch — no external CLI harness needed.

→ Pressure-variant table + worked PBP $10k/min example: [reference/pressure-testing.md](reference/pressure-testing.md)

## Quality Gates (7 Checks)

Before creating a skill, verify:

1. ✅ **🔴 IMPLEMENTED** — pattern operates on **existing code**, not ideas/exploration
2. ✅ **Necessity** — occurred 3+ times **on real codebase**
3. ✅ **Uniqueness** — no existing skill covers it
4. ✅ **Automatable** — can be automated (not pure judgment)
5. ✅ **Maintainable** — worth long-term maintenance
6. ✅ **ROI** — time saved ≥ 10x maintenance cost
7. ✅ **Behavior-tested** — ≥1 RED + ≥1 GREEN + ≥1 combined-pressure documented (see Pressure-Test Before Ship)

If any fails → reject or defer.

**Gate 1 (Implementation Check) questions**: Does the code exist (not planned)? Was the pattern run on real files (not theoretical)? Did we make actual changes (not just explore)? Is it about validating existing logic (not designing new)?

→ Worked ❌ REJECT / ✅ APPROVE Gate-1 examples: [reference/examples.md](reference/examples.md)

## Common Rejection Reasons

1. **🔴 NOT IMPLEMENTED** (most common) — exploration/planning, no code yet
2. **Prototype phase** — logic may change, wait until stable
3. **One-off tasks** — exploration, won't repeat
4. **Existing skill** — already covered (e.g. `/adversarial-review`)
5. **Too specific** — only this exact file
6. **Low frequency** — once per quarter
7. **Judgment-heavy** — requires human decision-making
8. **Low ROI** — saves little, complex to maintain
9. **Better alternatives** — simpler to just document the steps

→ Worked NOT-IMPLEMENTED (auto-reject) vs IMPLEMENTED (consider) scenarios: [reference/examples.md](reference/examples.md)

## Success Criteria

A successfully created skill should: 1. **Solve a real problem** (actual pattern, not theory); 2. ⚡ **Save time** (≥25 min/use, measurable); 3. 🔄 **Be used regularly** (≥2x/month); 4. 📈 **Positive ROI** (≥5x within 90 days); 5. 🔧 **Maintainable** (easy to update, clear docs).

## Best Practices

**DO** ✅ — analyze the FULL session before suggesting · require 3+ occurrences · show concrete examples from real sessions · calculate realistic (not optimistic) ROI · get approval BEFORE creating · test the generated skill on the original pattern · document why · follow existing conventions · track actual ROI at 30/90 days.

**DON'T** ❌ — create for theoretical needs · suggest after 1–2 occurrences · auto-create without approval · overestimate savings · skip validation · ignore existing skills · create overlapping/too-specific skills · forget the creation log · create-and-forget (monitor usage).

## Deferred Backlog

Track deferred candidates (Monitoring / Deferred / Rejected) — format in [reference/templates.md](reference/templates.md#deferred-backlog-format).

## Related Skills

| Skill | Relationship |
|-------|--------------|
| `/kaizen` | Improves existing skills (complementary) |
| `/orchestrate` | Complementary manual meta-skill — lists skill-creator as a Meta-Skill with **no automatic trigger** (invoke manually) |
| `/architect` | Both use systematic analysis patterns |
| `/qa-audit` | Both validate quality systematically |

## Remember

> "Skills should emerge from patterns, not predictions." **Wait for proof (3+ occurrences). Get approval. Create quality. Track ROI.**

Don't create skills prematurely. Let patterns prove themselves. Semi-automation prevents skill bloat while ensuring real needs are met.

---

## Meta-Kaizen

> Changelog archived to [`kaizen_log.md`](kaizen_log.md).

<!-- Kaizen: 2026-07-04 - User correction -->
- Rule: Phase 6 (Validate) MUST chain `/optimize-skill` before declaring a NEW skill done — not just the RED/GREEN pressure test. A cloned template gives structure, not correctness.
- Why: Authoring `/comments` (origin-platform skill) by cloning `timezone/SKILL.md` skipped Context7 grounding (Step 0) and independent validation (Step 4); running `/optimize-skill` retroactively caught real secrets-grep false-negatives the happy-path author missed.
- How to apply: after pressure-testing, run `/optimize-skill` on the new skill — its Step-0 grounds against current Agent Skills docs, its Step-4 runs an INDEPENDENT (separate-session) validation. Never self-verify.
- Source: User correction on 2026-07-04 (inherited from the origin platform).

<!-- Kaizen: 2026-07-06 - User correction -->
- Rule: Phase 6 is NOT complete when the SKILL.md passes RED/GREEN + `/optimize-skill`. Add a mandatory final step: WIRE the skill into its trigger — append its row to the `CLAUDE.md` Skill Router table (or `CLAUDE.local.md` where the project uses one) AND wire relevant entry points (orchestrate Step 0, per-file globs) — then `grep` the router to confirm the row landed before declaring done.
- Why: Quality gates measure file correctness, not discoverability. `/investigation` passed every gate (pressure-test + optimize-skill 8/8) but was never added to the router, so it never fired — the user reported "nunca usa lo que hicimos." The router is the always-on trigger; a validated-but-unrouted skill is orphaned (same failure as `_RPI-TEMPLATE.md` before it was wired into orchestrate Step 0).
- How to apply: closing checklist gains "registered in the CLAUDE.md Skill Router + entry points wired + grep-verified" alongside the behavior-test and optimize-skill gates.
- Source: User correction on 2026-07-06 (inherited from the origin platform).
