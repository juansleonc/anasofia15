# Examples — Gate-1 Implementation Check & NOT-IMPLEMENTED Scenarios

The 7 Quality Gates checklist and the 9 rejection reasons (decision logic) live in
the SKILL.md body. This file holds the worked ❌/✅ examples that illustrate them.

## Gate 1: Implementation Check (CRITICAL) — Examples

❌ **REJECT - Not Implemented**:
```
Pattern: RBAC permission validation
Context: Brainstorming RBAC architecture
Sessions: 3 discussions about RBAC design
Code: None (still planning)
Decision: REJECT - No code exists, pure exploration
```

✅ **APPROVE - Implemented**:
```
Pattern: RBAC permission validation
Context: Manually validated RBAC in 3 PRs
Sessions: Checked ability files in existing code
Code: RBAC system already implemented in app/abilities/
Decision: APPROVE - Validated real code 3 times
```

❌ **REJECT - Exploration**:
```
Pattern: Payment gateway consistency
Context: Researching how to unify gateways
Sessions: 2 sessions reading gateway code
Code: No changes, just exploring patterns
Decision: REJECT - Still in research phase
```

✅ **APPROVE - Operational**:
```
Pattern: Payment gateway consistency
Context: Fixed bugs in 3 different gateways
Sessions: Compared implementations, found divergence
Code: Made changes to 3 gateways (stripe, kushki, azul)
Decision: APPROVE - Pattern proven on real implementations
```

## NOT IMPLEMENTED (Auto-Reject) — Scenarios

**Scenario 1: Planning Session**
```
User: "Let's design RBAC permissions system"
Session: 3 hours discussing architecture
Pattern detected: RBAC validation
Decision: ❌ REJECT - No code exists, pure planning
```

**Scenario 2: Exploration**
```
User: "How do other payment gateways handle errors?"
Session: Read 5 gateway files, took notes
Pattern detected: Gateway error comparison
Decision: ❌ REJECT - Research only, no implementation
```

**Scenario 3: Prototype**
```
User: "Try implementing webhook retry logic"
Session: Wrote prototype code, may refactor
Pattern detected: Webhook retry validation
Decision: ❌ REJECT - Prototype phase, unstable
```

## IMPLEMENTED (Consider for Skill) — Scenarios

**Scenario 1: Validated Existing Code**
```
User: "Fix RBAC bug in reservations controller"
Session: Manually checked ability files 3 times
Code: RBAC already exists in app/abilities/
Pattern detected: RBAC validation
Decision: ✅ CONSIDER - Real code, proven pattern
```

**Scenario 2: Repeated Fix**
```
User: "Fix N+1 in dashboard, again"
Session: 3 different N+1 bugs fixed
Code: Changes made to 3 controllers
Pattern detected: N+1 detection
Decision: ✅ CONSIDER - Repetitive work on real code
```
