# Templates — Skill Creator

Table of Contents:
1. [Proposal Format](#proposal-format)
2. [Skill Template Generation](#skill-template-generation)
3. [Creation-Log Template](#creation-log-template)
4. [Deferred Backlog Format](#deferred-backlog-format)
5. [Output / Detection-Report Format](#output--detection-report-format)

---

## Proposal Format

When a candidate is detected, present:

```markdown
# Skill Creation Proposal

## Pattern Detected
**Name**: <descriptive-name>
**Occurrences**: X times (last Y days)
**Consistency**: Z% (how similar each time)
**Manual time**: N minutes per occurrence

## Current Approach (Manual)
```bash
# Steps taken manually
1. grep pattern X
2. Read files A, B, C
3. Analyze for Y
4. Report Z
```
**Pain points**:
- Step 2 takes 10+ minutes
- Easy to miss edge cases
- Inconsistent between devs

## Proposed Skill
**Name**: `/<skill-name>`
**Purpose**: <one-line description>
**Workflow**:
1. Phase 1: <step>
2. Phase 2: <step>
...

**Required tools**:
- Grep, Read, Edit
- MCP tool: X (if applicable)

**Example usage**:
```bash
/skill-name
# Output:
# ✅ Validated: X patterns found
# ⚠️  Issues: Y problems detected
# 📊 Report: Z.md generated
```

## ROI Analysis
**Time saved per use**: 25 minutes
**Expected frequency**: 2x/week
**Annual savings**: 25 min × 2 × 52 = 43 hours/year
**Maintenance cost**: ~2 hours/year (kaizen updates)
**ROI**: 43 / 2 = **21.5x** ✅

**Recommendation**: 🔴 Create Now (ROI ≥ 10)

## Approval
- [ ] ✅ Approve - Create skill
- [ ] ⏸️ Defer - Monitor pattern for 2 more weeks
- [ ] ❌ Reject - Not worth automating (reason: _______)

---
If approved, run: `/skill-creator create skill-name`
```

---

## Skill Template Generation

When creating a new skill, use this structure.

**Frontmatter spec note**: The Anthropic Agent Skills spec only REQUIRES `name` + `description`. `allowed-tools` is OPTIONAL. `disable-model-invocation` is a Claude-Code harness extension (NOT part of the Anthropic Skills spec). Both are valid in this harness — emit them — but they are not universally required by the spec.

**Aesthetic note (middle ground)**: the epigraph quote/kanji line and the `## Philosophy` section are OPTIONAL — include them only when they add real signal. The per-skill changelog lives in a bundled `kaizen_log.md` (pointed to from the body), NOT inline in SKILL.md, to save body tokens.

```markdown
---
name: <skill-name>
description: <What the skill does AND when to use it, third person. State capability + concrete triggers. Do NOT encode a step/phase SEQUENCE an agent could follow in lieu of reading the body.>
allowed-tools: [Bash, Read, Grep, Glob, Edit, Write]   # optional
disable-model-invocation: false                          # Claude-Code harness extension (optional)
---

# <Skill Name> - <One-Line Purpose>

<!-- OPTIONAL epigraph (include only if it adds signal): -->
<!-- > "<Philosophical quote>" - <Japanese kanji> -->

## Purpose

<2-3 sentences explaining what this skill does and why it exists>

<!-- OPTIONAL: ## Philosophy — 1-2 paragraphs on approach + key insight. Omit if not needed. -->

## When to Use

### Automatic Triggers
- <condition 1>
- <condition 2>

### Manual Triggers
```bash
/<skill-name>                # Default usage
/<skill-name> <variant>      # Alternative mode
```

## Workflow (N Phases)

<If complex, use 6-phase structure like other skills>
<If simple, use step-by-step list>

## Examples

### Example 1: <Common Case>
<Concrete example from detected pattern>

### Example 2: <Edge Case>
<Show how skill handles variations>

## Related Skills

| Skill | Relationship |
|-------|--------------|
| `/<related>` | <how they work together> |

## Validation

Success criteria:
- ✅ <measurable outcome 1>
- ✅ <measurable outcome 2>

Failure indicators:
- ❌ <red flag 1>
- ❌ <red flag 2>

## Kaizen: Continuous Improvement

> "Every day we must improve" - 改善

**While executing this skill**, if you discover a better approach, a missing edge
case, or a tool that works better, you MUST:
1. Complete current task
2. Use Edit tool to append the improvement to this skill's `kaizen_log.md`
   (format: `<!-- Kaizen: YYYY-MM-DD --> Improvement`)

Changelog lives in `kaizen_log.md` (bundled), NOT inline here — keeps the body lean.
Seed `kaizen_log.md` on creation with:

  <!-- Kaizen: YYYY-MM-DD - Initial creation -->
  Created from pattern detected in session YYYY-MM-DD:
  - Original manual workflow took ~XX minutes
  - Skill automates XX% of steps
  - Expected ROI: X.Xx
```

---

## Creation-Log Template

Track skill creation in `.claude/skills/skill-creator/creation_log.md`:

```markdown
## YYYY-MM-DD - <skill-name>

### Detection
- Pattern: <description>
- Detected: <date>, <occurrences>
- Score: X/10
- ROI: X.Xx

### Approval
- Decision: ✅ Approved / ⏸️ Deferred / ❌ Rejected
- Reason: <why>
- Approved by: <user>

### Implementation
- Created: <date>
- Tools used: <list>
- Lines of code: <count>
- Time to create: <minutes>

### Validation
- First use: <date>
- Time saved: <actual vs estimated>
- Success rate: <percentage>
- User feedback: <comments>

### Impact (After 30 days)
- Times used: X
- Total time saved: Y hours
- Issues found: Z
- Kaizen improvements: N
- Actual ROI: X.Xx (vs estimated: Y.Yy)
```

---

## Deferred Backlog Format

Track deferred candidates:

```markdown
## Skill Creation Backlog

### Monitoring (Score 5-7, needs more data)
- [ ] **rbac-audit** (Score: 6/10, Occurrences: 2, Wait for: 1 more)
  - Pattern: RBAC permission validation
  - Last seen: YYYY-MM-DD
  - Decision: Monitor for 2 more weeks
  - Review date: YYYY-MM-DD

### Deferred (Score ≥8, but timing not right)
- [ ] **mobile-app-validator** (Score: 8/10, ROI: 12x)
  - Pattern: Validate mobile app compatibility
  - Reason deferred: Waiting for GraphQL skill refactor first
  - Dependencies: graphql skill update
  - Review date: After graphql refactor

### Rejected (Documented to avoid re-suggesting)
- [x] **git-commit-helper** (Score: 7/10)
  - Pattern: Git commit message formatting
  - Rejected: YYYY-MM-DD
  - Reason: Pre-commit hook already handles this
  - Suggested by: Session YYYY-MM-DD
```

---

## Output / Detection-Report Format

```markdown
# Skill Creation Opportunities - YYYY-MM-DD

## Session Analysis
- Patterns detected: X
- Candidates (score ≥8): Y
- Already covered: Z
- New opportunities: N

## Top Candidates (Ranked by ROI)

### 1. <skill-name> 🔴 CREATE NOW
**Score**: 9/10 (Strong candidate)
**ROI**: 21.5x
**Pattern**: <description>
**Occurrences**: 5 times (last 14 days)
**Time wasted**: 125 minutes total
**Proposed workflow**: <brief>

[View full proposal](#proposal-1)

---

### 2. <skill-name> 🟡 MONITOR
**Score**: 6/10 (Needs more data)
**Occurrences**: 2 times
**Recommendation**: Wait for 1 more occurrence

---

## Detailed Proposals

### Proposal 1: <skill-name>
<Full proposal format from above>

---

## Actions
- [ ] Review proposals above
- [ ] Approve/defer/reject each candidate
- [ ] Run `/skill-creator create <name>` for approved skills

Total potential time savings: XXX hours/year
```
