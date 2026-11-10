# ROI Prioritization & Reporting Formats

> Reference detail for `kaizen/SKILL.md`. The body keeps the one-line ROI gist; the full
> scoring tables, output format, and kaizen-log format live here.

## ROI Prioritization System

### ROI Calculation
```
Impact Score:
  High = 3 (affects all users, frequent use, critical path)
  Med  = 2 (affects some users, occasional use)
  Low  = 1 (affects few users, rare use, nice-to-have)

Effort Score:
  Low  = 3 (< 10 min, simple change)
  Med  = 2 (10-30 min, moderate complexity)
  High = 1 (> 30 min, major rewrite)

ROI = Impact / Effort

Priority Decision:
  ROI ≥ 1.5 → 🔴 Do Now
  ROI ≥ 1.0 → 🟡 Do Soon
  ROI < 1.0 → 🟢 Consider/Skip
```

### Priority Matrix
```
           │ Low Effort │ Med Effort │ High Effort
───────────┼────────────┼────────────┼─────────────
High Impact│ 🔴 Do Now  │ 🔴 Do Now  │ 🟡 Schedule
Med Impact │ 🟡 Do Soon │ 🟡 Do Soon │ 🟢 Consider
Low Impact │ 🟢 Maybe   │ ⚪ Skip    │ ⚪ Skip
```

### Ecosystem Priority Formula
For full ecosystem audits, prioritize skills by:

```
Priority = (Usage × Complexity × Days_Since_Kaizen) / 100

Where:
- Usage: High=3, Med=2, Low=1 (how often skill is used)
- Complexity: High=3, Med=2, Low=1 (how complex the skill is)
- Days: Actual days since last kaizen improvement

Example:
- tdd (High usage, High complexity, 30 days)
  = (3 × 3 × 30) / 100 = 2.7 → Priority: HIGH

- docker-exec (Med usage, Low complexity, 10 days)
  = (2 × 1 × 10) / 100 = 0.2 → Priority: LOW
```

## Output Format

```markdown
# Kaizen Report: <Skill Name> - YYYY-MM-DD

## Summary
- Issues found: X
- Changes applied: Y (ROI ≥ 1.0)
- Skipped: Z (ROI < 1.0)
- Estimated impact: High/Med/Low

## Before/After Metrics
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Clarity score (1-10) | 6 | 9 | +50% |
| Avg execution time | 5min | 3min | -40% |
| Success rate | 80% | 95% | +19% |
| Steps count | 12 | 8 | -33% |

## Changes Applied

1. ✅ **Type**: Description (ROI: X.X)
   - Before: Quote from old skill.md
   - After: New approach
   - Benefit: Specific improvement

[Repeat for each change]

## Skipped Improvements

1. ⏭️ **Type**: Description (ROI: X.X)
   - Reason: Why skipped (low impact, etc.)
   - Deferred: When to reconsider

## Lessons Learned
- Key takeaway 1 (ecosystem-wide)
- Pattern that could propagate to other skills
- Technical insight discovered

## Next Steps
- Remaining opportunities: X
- Recommended next skill: Y (Priority: Z)
```

## Kaizen Log Format

All improvements tracked in `.claude/skills/kaizen/kaizen_log.md`:

```markdown
## YYYY-MM-DD - skill-name

### Issues Found
1. **Type**: Description (Impact: X, Effort: Y, ROI: Z)

### Changes Made
```diff
- Old approach
+ New approach
```

### Impact
- Metric: before → after (change%)
- Example: Failure rate: 5% → 1% (-80%)

### Lessons Learned
- Key takeaway that applies to other skills
- Pattern that could be propagated
```
