# Improvement Categories & Patterns Catalog

> Reference detail for `kaizen/SKILL.md`. The body keeps the decision logic; this file is
> the lookup catalog of category fixes and reusable improvement patterns.

## Improvement Categories (5 Types)

### 1. Clarity Issues
**What**: Vague instructions, missing examples, unclear expectations
**Fix**: Add specific commands, expected output, concrete examples

```markdown
❌ BAD: "Check the code for issues"
✅ GOOD: "Run the security scan to detect OWASP Top 10 vulnerabilities:
         <security-scan command from stack.md#audit-checks>
         Expected: Exit code 0, no new vulnerabilities"
```

### 2. Efficiency Issues
**What**: Redundant steps, sequential independent tasks, repeated operations
**Fix**: Parallelize, cache results, optimize workflow

```markdown
❌ BAD: Run 5 sequential commands that could be parallel
✅ GOOD: Mark independent tasks for parallel execution with Agent tool
```

### 3. Reliability Issues
**What**: Missing error handling, unvalidated assumptions, no fallbacks
**Fix**: Add validations, handle edge cases, provide recovery steps

```markdown
❌ BAD: Assume file exists, read it directly
✅ GOOD: Check if file exists first, handle missing case gracefully
```

### 4. Validation Issues
**What**: Success assumed not verified, vague criteria, no failure detection
**Fix**: Parse output, verify exact conditions, explicit expectations

```markdown
❌ BAD: "Verify coverage"
✅ GOOD: "Run: <per-file coverage command from stack.md#coverage>
         Expected output: 'Coverage: 100%'"
```

### 5. Maintainability Issues
**What**: Hardcoded values, undocumented choices, duplicate content
**Fix**: Reference conventions, explain decisions, link to shared docs

```markdown
❌ BAD: Hardcoded path, magic numbers
✅ GOOD: Use CLAUDE.md conventions, reference shared docs, explain constants
```

## Improvement Patterns (5 Patterns)

### Pattern 1: Cross-Pollinate Best Practices
When one skill discovers a useful pattern, propagate it:

```markdown
Example: /tdd discovers a fixture optimization pattern
→ Check if /coverage, /adversarial-review need the same pattern
→ Record it in shared/stack.md#test-conventions (single source of truth)
→ Reference from all relevant skills
```

### Pattern 2: Consolidate Duplicates
Multiple skills with similar content should reference shared docs:

```markdown
Before:
- /tdd has fixture rules (50 lines)
- /coverage has fixture rules (45 lines, slightly different)
- /adversarial-review has fixture rules (60 lines, different again)

After:
- shared/stack.md#test-conventions (single source of truth)
- All skills reference: "See [stack.md — Test conventions](../../shared/stack.md#test-conventions)"
- Each skill has 2-3 key points only
```

### Pattern 3: Update Examples
Code examples become stale. Scan for forbidden/outdated patterns with
`bash .claude/skills/qa-audit/qa_audit.sh` — the skill-tree audit (AI mentions, residue on
tracked files, dangling links, anchor parity, slash-mention resolution) — then refresh any
matches.

### Pattern 4: Add Integration Points
Skills should reference related skills:

```markdown
## Related Skills
- Use the project's domain skill (stack.md#analysts) for domain knowledge
- Use `/tdd` for test implementation
- Use `/coverage` to verify 100% coverage
- Part of an `/orchestrate` workflow
```

### Pattern 5: Improve Workflow Efficiency
Look for opportunities to parallelize or skip unnecessary steps:

```markdown
Example: Can analysis skills run in parallel?
- Independent analyst skills (stack.md#analysts) don't share state
- Launch them as parallel Agent calls in one message
- Update /orchestrate workflow map
```

## Common Improvements (Quick Patterns)

### 1. Add Shared Reference
```markdown
<!-- Before -->
## Factory Rules
[50 lines of factory documentation]

<!-- After -->
## Fixture Rules
> 📖 **See [stack.md — Test conventions](../../shared/stack.md#test-conventions) for complete patterns.**

Quick reference:
- build(:factory) - DEFAULT for validations, methods
- create(:factory) - ONLY for scopes, queries, DB ops
```

### 2. Update Docker Commands
```markdown
<!-- Before -->
<test runner invoked directly, bypassing the project exec wrapper>

<!-- After -->
<run-one-test command from stack.md#commands>
```

### 3. Add Integration Points
```markdown
## Related Skills
- Use `/tdd` for test implementation
- Use `/coverage` to verify 100% coverage
- Part of `/orchestrate feature` workflow
```

### 4. Add Kaizen Entry
```markdown
<!-- Kaizen: 2026-01-26 -->
- Added: Shared reference to stack.md#test-conventions (removed 50 lines duplication)
- Updated: all commands to use the project exec wrapper (stack.md#commands)
- Added: Related Skills section
- Fixed: Broken MCP tool reference
```
