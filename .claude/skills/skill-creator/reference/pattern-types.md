# Pattern Detection (5 Types)

## Type 1: Repetitive Grep + Read Sequences
**Signal**:
```
Session activity:
- Grep for pattern X
- Read files A, B, C (same files each time)
- Extract similar information
- Repeat 3+ times
```

**Example candidate**:
```markdown
**Pattern**: RBAC permission validation
**Detected**: 5 times last week
**Steps**: grep "authorize" → read ability files → verify tenant-scoping
**Time**: ~30 min each
**Proposal**: Create a new skill named `rbac-validate`
```

## Type 2: Manual Agent Tool Invocations
**Signal**:
```
Session activity:
- Agent tool with subagent_type=Explore
- Prompt: "Find all X and check Y"
- Same pattern 3+ times
- Similar workflow each time
```

**Example candidate**:
```markdown
**Pattern**: Payment gateway consistency check
**Detected**: 3 times this month
**Steps**: Find gateway implementations → compare patterns → report differences
**Time**: ~45 min each
**Proposal**: Create a new skill named `gateway-consistency` (wait, this exists!)
```

## Type 3: Multi-Validator Sequences
**Signal**:
```
Session activity:
- Run /validator-1
- Run /validator-2
- Run /validator-3
- Always in same order
- Could be parallelized
```

**Example candidate**:
```markdown
**Pattern**: Pre-deployment validation suite
**Detected**: Every PR (10+ times)
**Steps**: /security → /multi-tenancy → /timezone → /performance
**Time**: ~12 min sequential (could be 3 min parallel)
**Proposal**: Create a new skill named `pre-deploy` with parallel validation
```

## Type 4: Complex Manual Analysis
**Signal**:
```
Session activity:
- Read production metrics (the project's observability oracles — see `.claude/skills/shared/stack.md#observability`)
- Cross-reference with code
- Identify root cause
- Suggest fix
- Repeat for similar issues
```

**Example candidate**:
```markdown
**Pattern**: N+1 query debugging from production
**Detected**: 4 times last 2 weeks
**Steps**: Slow-query reports from your analytics store (see `.claude/skills/shared/stack.md#observability`) → find code → analyze → suggest fix
**Time**: ~20 min each
**Proposal**: Create a new skill named `n1-detective`
```

## Type 5: Documentation Generation
**Signal**:
```
Session activity:
- Analyze code structure
- Generate architecture diagram
- Write documentation
- Same format/structure each time
```

**Example candidate**:
```markdown
**Pattern**: Package documentation generation
**Detected**: Once per new package (7 packages)
**Steps**: Analyze the module/package structure → generate docs → create diagrams
**Time**: ~40 min each
**Proposal**: Create a new skill named `package-documenter`
```
