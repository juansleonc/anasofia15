---
name: kaizen
description: Continuous skill improvement meta-skill. Audits, refines, and enhances all skills in the ecosystem through ROI-prioritized iteration. Use when skills fail repeatedly, after major changes, or for periodic ecosystem health checks.
allowed-tools: [Bash, Read, Grep, Glob, Edit, Write]
disable-model-invocation: true
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Kaizen Skill - Continuous Skill Improvement (Consolidated Edition)

> "Sharpen the saw" - 改善 (Kaizen)

## Purpose & Principles

Meta-skill: systematically improve quality, efficiency, and effectiveness of ALL ecosystem skills via analysis, testing, and refinement. Skills are code; code degrades; therefore skills need continuous improvement (incremental > delayed perfection).

A sharp skill is **Accurate** (does what it promises), **Efficient** (no wasted steps), **Clear**, **Reliable**, **Maintainable**.

Operating principles: **data-driven** (real usage/failures guide changes), **systematic** (regular audits), **collaborative** (mine each skill's kaizen log), **measurable** (track before/after), **ROI-focused** (high-impact, low-effort first).

## When to Use

### Heuristics for WHEN to invoke manually

**No automatic mechanism exists; this skill is manual-only.** (`disable-model-invocation: true` in frontmatter.) The bullets below are signals a human should watch for, not automated triggers:

- A skill has failed 2+ times in the same session
- A skill has not been improved in 90+ days
- After a major change (framework or major-dependency upgrade, new patterns, MCP tools added/removed)
- After user feedback that a skill produced wrong or misleading output
- Periodic ecosystem health check (monthly/quarterly cadence if desired)

### Manual Invocation
```bash
/kaizen                    # Full ecosystem audit
/kaizen <skill-name>       # Improve specific skill
/kaizen report             # Generate improvement metrics
/kaizen suggest            # Suggest improvements based on recent sessions
/kaizen metrics            # Show skill usage and effectiveness metrics
```

## Kaizen Cycle (6 Phases)

OBSERVE → ANALYZE → DESIGN → IMPLEMENT → VALIDATE → REFLECT. Each invocation mode (see
Kaizen Workflows) runs this loop at a different scope.

> 📖 Full per-phase checklist (ASCII cycle diagram): [reference/kaizen-cycle.md](reference/kaizen-cycle.md)

## Audit Checklist (For Each Skill)

### Critical Priority (Must Pass)
- [ ] YAML frontmatter is valid
- [ ] All tools in allowed-tools exist
- [ ] No broken tool references in content
- [ ] All shared doc references resolve (no missing ../shared/*.md files)

> **Frontmatter portability note**: `disable-model-invocation` and `allowed-tools` are Claude Code harness extensions — the portable Agent Skills spec requires only `name` + `description` (plus optional `license`/`metadata`/`compatibility`). Don't flag their presence as non-compliant in THIS repo, but note them as Claude-Code-specific when auditing portable/published skills.

### High Priority (Should Pass)
- [ ] Has clear description in frontmatter
- [ ] description: states triggers only — no workflow/phase/step summary (cross-ref skill-creator's CSO Rule)
- [ ] Purpose is well-defined
- [ ] No outdated patterns (Time.now, allow_any_instance_of, .to_s(:db))
- [ ] Examples use correct factory patterns (build > build_stubbed > create)
- [ ] Commands follow the project exec wrapper defined in stack.md#commands (never bypass it)
- [ ] Consistent with CLAUDE.md rules
- [ ] Skill achieves its stated purpose
- [ ] Instructions are actionable

### Medium Priority (Nice to Have)
- [ ] When to use section exists
- [ ] Examples are present and accurate
- [ ] References to shared docs are correct
- [ ] No duplicate content across skills
- [ ] Clear dependency relationships
- [ ] Workflow is efficient
- [ ] No unnecessary complexity

### Low Priority (Optional)
- [ ] Recent kaizen entries exist
- [ ] Related skills section present

## Behavior-Test Eval (When Auditing an Existing Skill)

Text audits (reading, checklist, dry-run) catch syntax and structural issues but cannot tell you whether the skill actually changes subagent behavior. After any audit that finds a defect — or when a skill repeatedly fails or produces incorrect output — run the pressure-test protocol from `skill-creator/SKILL.md` ("Pressure-Test Before Ship") against the skill being audited. Canonical protocol lives there; this section is the kaizen integration point only.

**Quick eval loop:**

1. **RED baseline**: dispatch a fresh subagent (Agent tool) on a scenario the skill governs, WITHOUT providing the skill. If the agent already complies without the skill, the section is a **redundant-section candidate** (see below).
2. **GREEN check**: re-run the same scenario WITH the skill present. If the agent still fails, the skill text is not landing — **rewrite the section, do not append more text**.
3. **Pressure variant**: rerun GREEN under combined pressures (time + sunk cost + authority). A skill that only works without pressure is not proven.

Document results in the skill's Kaizen entry. An audit without a behavior test only proves the skill READS correctly, not that it WORKS.

### Prune Counterpart

Kaizen entries historically only add content — the natural direction is growth. The eval step above is the deletion mechanism. Apply it when:

- A section fails the RED baseline (agent complied without the skill) → the section is redundant bloat; candidate for pruning or consolidation.
- A section fails GREEN despite being present → rewrite from scratch, not append; appending redundant counters grows the file without fixing the root cause.

Before pruning, verify: re-run RED with the section removed. If behavior is unchanged, remove it. If behavior regresses, keep and rewrite.

---

## Improvement Categories & Patterns

Two catalogs drive the DESIGN/IMPLEMENT phases — five issue **categories** (Clarity,
Efficiency, Reliability, Validation, Maintainability) each with a BAD→GOOD fix, and five
reusable **patterns** (cross-pollinate, consolidate duplicates, update examples, add
integration points, improve workflow efficiency). Match the defect to a category, apply the
matching pattern.

> 📖 Full catalog with BAD→GOOD examples + quick-pattern snippets: [reference/improvement-catalog.md](reference/improvement-catalog.md)

## ROI Prioritization (Gist)

`ROI = Impact / Effort` (each scored 1–3): **ROI ≥ 1.5 → Do Now · ≥ 1.0 → Do Soon · < 1.0 → Consider/Skip.** For full ecosystem audits, rank skills by `(Usage × Complexity × Days_Since_Kaizen) / 100`.

> 📖 Score tables, priority matrix, ecosystem formula, Output Format & Kaizen Log Format: [reference/roi-and-reporting.md](reference/roi-and-reporting.md)

## Validation Commands

Run the canonical audit (AI-mention scan, command-residue lint, dangling-link check,
anchor-parity check, slash-mention resolution, coverage/forbidden-pattern docs) from the
repo root — this is the single audit entrypoint for the whole skill ecosystem:

```bash
bash .claude/skills/qa-audit/qa_audit.sh
```

> 📖 Script: [../qa-audit/qa_audit.sh](../qa-audit/qa_audit.sh) — the skill-tree audit (AI mentions, residue on tracked files, dangling links, anchor parity, slash-mention resolution).

## Kaizen Workflows

Four invocation modes; each follows the 6-phase cycle above but with a different scope:

| Command | Scope | Phases used | Key output |
|---------|-------|-------------|------------|
| `/kaizen` | Full ecosystem audit | All 6 | Priority matrix → top 5 → propose → implement → report |
| `/kaizen <skill>` | Single skill | All 6 | Audit checklist → ROI proposals → approval → edit → kaizen_log.md entry |
| `/kaizen metrics` | Read-only health report | 1–2 only | Skill health table (last kaizen, issues, status) |
| `/kaizen suggest` | Suggest next targets | 1–2 only | Ranked shortlist of improvement candidates |

**Workflow steps by mode:**

`/kaizen` (full audit): Inventory all skills with `ls .claude/skills/ | grep -v -E 'CLAUDE|shared' | wc -l` → score each by (Usage × Complexity × Days)/100 → audit top 5 → present findings → implement one at a time with approval → report.

`/kaizen <skill>`: Read skill completely → run audit checklist → score issues by ROI (Impact/Effort) → show top-5 proposals → get approval → apply edits → validate YAML/tools/refs → update `kaizen_log.md` → suggest next skill.

`/kaizen metrics`: Gather per-skill stats (total entries, last date, issue count) → produce health table with status (Healthy / Review / Action Required).

`/kaizen suggest`: Review recent session failures/patterns → cross-reference `kaizen_log.md` → emit ranked shortlist with estimated ROI.

## Integration with Orchestrator

The orchestrator integrates kaizen in these ways:

### 1. After Skill Failures
```
If skill X fails 2+ times in session:
  1. Complete current task with alternative approach
  2. Queue skill X for kaizen analysis
  3. At end of session, notify user:
     "⚠️ Skill X failed multiple times. Run /kaizen X to improve?"
```

### 2. Periodic Reviews
```
Heuristic (manual): after roughly 10 skill executions in a session,
consider running /kaizen suggest to surface improvement opportunities.
No automatic trigger exists — this is a signal for human judgment.
```

### 3. After Successful Workflows
```
After successful workflow completion:
  1. Log success pattern
  2. Note any improvements discovered during execution
  3. Update relevant skill kaizen sections with learnings
```

## Success Criteria

A skill is "sharp" (see attributes in Purpose & Principles) when it measurably hits:
**Clarity** (0 user questions about what to do) · **Efficiency** (no redundant steps, optimal tool usage) · **Reliability** (>95% success, edge cases handled) · **Validation** (explicit success/failure criteria) · **Maintainability** (easy to update, clear docs).

## Best Practices

### DO ✅
- Read skill.md completely before suggesting changes
- Prioritize by ROI (Impact/Effort)
- Get user approval for major changes
- Validate with dry-run after changes
- Document before/after metrics
- Update kaizen_log.md
- Consider side effects on dependent skills
- Small, frequent improvements over large overhauls
- Cross-pollinate patterns across skills
- Test examples still work after updates

### DON'T ❌
- Make changes without understanding context
- Improve everything at once (focus on high ROI)
- Skip validation phase
- Forget to update orchestrator dependencies
- Ignore user feedback
- Change for the sake of change
- Break dependent skills
- Wait for perfection (iterate instead)

## Maintenance Schedule

### Proactive (Recommended — all manual)
```
~Every 10 executions: /kaizen suggest (manual heuristic, no auto-trigger)
Monthly:              /kaizen report (ecosystem health check)
Quarterly:            Improve top 3 priority skills
Yearly:               Full audit of all skills (count dynamically: `ls .claude/skills/ | grep -v -E 'CLAUDE|shared' | wc -l`)
```

### Reactive (As Needed)
```
Immediately:      Skill fails 2+ times in session
Within 1 week:    User reports confusion
Within 1 month:   Skill not improved in 90+ days
```

## Related Skills

| Skill | Relationship |
|-------|--------------|
| `/orchestrate` | Coordinates kaizen checks, triggers after failures |
| `/qa-audit` | Validates skill quality (complementary) |
| `/code-review` (Claude Code built-in) | Uses similar analysis patterns |
| `/architect` | Applies similar systematic thinking |

## Meta-Kaizen

Skills are living documentation: improve incrementally, document progress, share learnings — and apply kaizen to kaizen itself.

<!-- Improvement history archived to kaizen_log.md. Recent: 2026-06-10 Behavior-Test Eval · 2026-06-14 sed-fix + densify · 2026-06-15 progressive-disclosure relocation (616→241 lines; cycle/catalog/ROI→reference/*) · 2026-07-09 removed scripts/validate_skill.sh (structurally could not fail, called a nonexistent linter) — qa-audit/qa_audit.sh is now the single audit entrypoint. Bundled detail: reference/kaizen-cycle.md · reference/improvement-catalog.md · reference/roi-and-reporting.md -->
