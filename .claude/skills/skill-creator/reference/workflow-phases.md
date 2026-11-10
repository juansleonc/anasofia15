# Workflow: Skill Creation (6 Phases)

```
┌─────────────────────────────────────────────────────────┐
│           SKILL CREATION WORKFLOW (6 PHASES)            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Phase 1: DETECT (Session Analysis)                    │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Scan session transcript                    │      │
│  │ • Identify tool usage patterns               │      │
│  │ • Extract repeated workflows                 │      │
│  │ • Count occurrences of similar tasks         │      │
│  │ • Calculate time spent on each pattern       │      │
│  │ • Group similar activities                   │      │
│  │ • Score each pattern (0-10)                  │      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 2: ANALYZE (Validate Candidates)                │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Check if existing skill already covers it  │      │
│  │ • Verify pattern is consistent (≥80%)        │      │
│  │ • Estimate time savings (ROI)                │      │
│  │ • Identify required tools                    │      │
│  │ • Check if generalizable (not one-off)       │      │
│  │ • Assess complexity (can be automated?)      │      │
│  │ • Filter: score ≥ 8 = candidate              │      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 3: PROPOSE (Generate Proposal)                  │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Create skill proposal document              │      │
│  │ • Define: name, purpose, workflow            │      │
│  │ • Estimate: time saved, frequency            │      │
│  │ • List: required tools, dependencies         │      │
│  │ • Show: example before/after                 │      │
│  │ • Calculate: ROI = time_saved / maintenance  │      │
│  │ • Present to user for approval               │      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 4: APPROVE (User Decision)                      │
│  ┌──────────────────────────────────────────────┐      │
│  │ User reviews proposal:                        │      │
│  │ ├── Is this actually useful?                 │      │
│  │ ├── Will it be used frequently?              │      │
│  │ ├── Worth maintaining long-term?             │      │
│  │ └── Better than manual approach?             │      │
│  │                                               │      │
│  │ Options:                                      │      │
│  │ ✅ Approve → Proceed to Phase 5              │      │
│  │ ⏸️  Defer → Add to backlog, monitor pattern  │      │
│  │ ❌ Reject → Document why (avoid re-suggesting)│      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 5: GENERATE (Create Skill File)                 │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Create .claude/skills/<name>/SKILL.md      │      │
│  │ • Generate YAML frontmatter                  │      │
│  │ • Write Purpose section                      │      │
│  │ • Define When to Use                         │      │
│  │ • Document Workflow (6 phases if complex)    │      │
│  │ • Add examples from detected pattern         │      │
│  │ • Include Related Skills references          │      │
│  │ • Add initial Kaizen section                 │      │
│  │ • Follow skill template standards            │      │
│  └──────────────────────────────────────────────┘      │
│                        ▼                                │
│  Phase 6: VALIDATE (Quality Check)                     │
│  ┌──────────────────────────────────────────────┐      │
│  │ • Verify YAML frontmatter valid              │      │
│  │ • Check all tool references exist            │      │
│  │ • Validate markdown structure                │      │
│  │ • Ensure follows conventions (CLAUDE.md)     │      │
│  │ • Test skill on original pattern             │      │
│  │ • Compare results: manual vs skill           │      │
│  │ • Document in skill creation log             │      │
│  │ • Update orchestrator if needed              │      │
│  │ • [ ] Behavior-tested: ≥1 RED + ≥1 GREEN    │      │
│  │       + ≥1 combined-pressure documented      │      │
│  │       → see "Pressure-Test Before Ship"      │      │
│  └──────────────────────────────────────────────┘      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
