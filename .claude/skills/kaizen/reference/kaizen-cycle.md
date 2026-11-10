# Kaizen Cycle (6 Phases)

> Reference detail for `kaizen/SKILL.md` → "Kaizen Cycle" pointer. The decision cores
> (When-to-Use, Audit Checklist, Behavior-Test Eval, Workflows) stay in the body.

```
┌─────────────────────────────────────────────────────────┐
│                   KAIZEN IMPROVEMENT CYCLE              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Phase 1: OBSERVE (Data Collection)                    │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Scan all skill files                       │      │
│  │ • Skill execution metrics (if available)     │      │
│  │ • User feedback patterns                     │      │
│  │ • Failed execution analysis                  │      │
│  │ • Dependency analysis                        │      │
│  │ • Parse kaizen sections (lessons learned)    │      │
│  │ • Recent skill execution failures            │      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 2: ANALYZE (Find Root Causes)                   │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Read skill.md thoroughly                   │      │
│  │ • Check for outdated patterns                │      │
│  │ • Identify unclear instructions              │      │
│  │ • Find redundant steps                       │      │
│  │ • Detect missing validations                 │      │
│  │ • Analyze tool usage patterns                │      │
│  │ • Identify inconsistencies across skills     │      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 3: DESIGN (Plan Improvements)                   │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Propose specific changes                   │      │
│  │ • Estimate impact (High/Med/Low = 3/2/1)     │      │
│  │ • Estimate effort (Low/Med/High = 3/2/1)     │      │
│  │ • Calculate ROI = Impact / Effort            │      │
│  │ • Prioritize by ROI (≥1.5 = Do Now)          │      │
│  │ • Consider side effects                      │      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 4: IMPLEMENT (Apply Changes)                    │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Update skill.md with Edit tool             │      │
│  │ • Update outdated documentation              │      │
│  │ • Add missing examples                       │      │
│  │ • Consolidate duplicate patterns             │      │
│  │ • Cross-pollinate best practices             │      │
│  │ • Add Kaizen comment with date               │      │
│  │ • Update orchestrator dependencies           │      │
│  │ • Document changes in kaizen log             │      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 5: VALIDATE (Test Improvements)                 │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Verify YAML frontmatter is valid           │      │
│  │ • Check all tool references exist            │      │
│  │ • Validate markdown structure                │      │
│  │ • Test examples for accuracy                 │      │
│  │ • Ensure no broken references                │      │
│  │ • Dry-run skill with test scenario           │      │
│  │ • Verify instructions are clearer            │      │
│  │ • Check for unintended consequences          │      │
│  │ • Get user confirmation if major change      │      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 6: REFLECT (Document Learnings)                 │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Log improvements made                      │      │
│  │ • Update kaizen_log.md                       │      │
│  │ • Update metrics (skill health report)       │      │
│  │ • Record before/after metrics                │      │
│  │ • Note lessons learned                       │      │
│  │ • Suggest ecosystem-wide patterns            │      │
│  │ • Create improvement report                  │      │
│  │ • Add kaizen entry to improved skills        │      │
│  └──────────────────────────────────────────────┘      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
