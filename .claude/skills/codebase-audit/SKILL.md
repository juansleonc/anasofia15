---
name: codebase-audit
description: Use when running a full-application health check or pre-release audit across security, performance, code smells, resilience, database, testing, data isolation, dependency hygiene, API compatibility, and time handling.
allowed-tools: [Bash, Read, Grep, Glob, Edit]
disable-model-invocation: true
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

## When to Use This Skill

Run this skill when:
- **Before major releases** — comprehensive pre-deployment audit
- **Quarterly health checks** — track codebase health over time
- **After significant feature work** — validate no regressions introduced
- **New team member onboarding** — understand codebase health baseline
- **Tech debt planning** — identify highest-impact improvements

## Usage Variants

```
/codebase-audit              # Full audit (all 10 categories)
/codebase-audit security     # Security only
/codebase-audit performance  # Performance only
/codebase-audit code-quality # Code smells + structural quality
/codebase-audit resilience   # Error handling + external service resilience
/codebase-audit database     # Migrations + indexes + query patterns
/codebase-audit testing      # Test quality + fixture/factory patterns
/codebase-audit isolation    # Data isolation / scoping checks
/codebase-audit dependencies # Dependency hygiene + vulnerabilities
/codebase-audit api          # Backward-compatibility checks
/codebase-audit time         # Time/date handling safety
```

# Codebase Audit Orchestrator

Comprehensive application audit covering 10 categories, generalized to run against any stack via `../shared/stack.md` — no category here assumes a specific language, framework, or datastore.

## Audit Categories

| # | Category | Focus |
|---|----------|-------|
| 1 | **Security** | Injection, IDOR, credentials, OWASP-class issues |
| 2 | **Performance** | N+1 queries, missing indexes, memory, language-vs-datastore filtering |
| 3 | **Code Smells** | Oversized modules/handlers, design patterns |
| 4 | **Resilience** | Timeouts, error handling, silent failures |
| 5 | **Database** | Migration safety, indexes, schema quality |
| 6 | **Testing** | Coverage, patterns, fixture/factory optimization |
| 7 | **Data Isolation** | Tenant/account/customer scoping (was "multi-tenancy") |
| 8 | **Dependency Hygiene** | Vulnerabilities, unused, outdated dependencies (was "gem hygiene"); cross-reference `../shared/best-practices.md` when present |
| 9 | **API Compatibility** | Backward compatibility, client safety |
| 10 | **Time Handling** | Current-time/date usage safety (was "timezone safety") |

Each category's deep-dive is delegated to a matching project skill if one exists — see `../shared/stack.md#analysts` and the CLAUDE.md skill router for the current mapping. Where no matching skill exists, this skill performs that category's deep-dive itself (Phase 2).

## Execution Strategy

### Phase 1: Fast Automated Checks (Parallel)

Run the per-category checks defined in `../shared/stack.md#audit-checks` for Security, Performance, Code Smells, Resilience, Database, Data Isolation, Dependency Hygiene, and Time Handling. These are typically static grep/lint-style scans over the working tree; only checks that require this project's exec wrapper (`stack.md#commands`) need to run through it — pure file scans do not. Testing and API Compatibility have no fast-check phase — they always go straight to Phase 2.

For the Dependency Hygiene pass, consult `../shared/best-practices.md` when present (created by `/stack-sync`): flag any dependency whose recorded version range it violates, and flag any section stamped >90 days ago as drift. Note the finding and suggest a `/stack-sync` refresh — this never blocks the audit.

**Fill-loop rule**: if `stack.md#audit-checks` is TODO for a category, GENERATE stack-appropriate checks for this project's language/framework, run them, and record them in `stack.md` so the next audit reuses them.

(Ruby/Rails example — illustrates the shape a filled-in `stack.md#audit-checks` entry takes; the actual checks for a real project live in that project's stack.md, not here)
```bash
# Security — SQL injection via string interpolation
grep -rn 'where(".*\#{' app/ --include="*.rb" | wc -l

# Performance — in-memory filtering instead of a datastore query
grep -rn '\.all\.select\s*{\|\.all\.map\s*{' app/ --include="*.rb" | wc -l

# Time handling — non-frozen current-time calls
grep -rn 'Time\.now\|Date\.today\|DateTime\.now' app/ --include="*.rb" | wc -l
```

### Phase 2: Deep Analysis (Sequential, Per Category)

For each category with findings from Phase 1 (or, for Testing/API Compatibility, always): run the matching project skill if one exists (CLAUDE.md router / `stack.md#analysts`), else do the deep-dive manually.

1. Security findings > 0 → deep-dive Security
2. Performance findings > 0 → deep-dive Performance
3. Code smells > thresholds → deep-dive Code Smells
4. Resilience findings > 0 → deep-dive Resilience
5. Database findings > 0 → deep-dive Database
6. Run `/tdd` (+ any project fixture/factory-optimization skill) on recently changed tests
7. Data isolation findings > 0 → deep-dive Data Isolation
8. Run the project's dependency-audit skill for dependency health, or the commands in `stack.md#audit-checks` if none exists
9. If the API surface changed → run the project's API-compatibility skill, or do the deep-dive manually
10. Time handling findings > 0 → deep-dive Time Handling
11. **If domain-specific compliance requirements apply to the changed code (e.g. payment/PCI, health data/HIPAA) → run the matching compliance skill separately.** Do not rely on the Security category alone — a general security review does not cover domain-specific compliance requirements.

### Phase 3: Report Generation

## Report Format

```markdown
## Codebase Audit Report

**Date**: YYYY-MM-DD
**Scope**: Full / [Category]
**Branch**: [branch-name]

### Executive Summary

| Category | Status | Issues | Critical |
|----------|--------|--------|----------|
| Security | 🟢/🟡/🔴 | X | Y |
| Performance | 🟢/🟡/🔴 | X | Y |
| Code Smells | 🟢/🟡/🔴 | X | Y |
| Resilience | 🟢/🟡/🔴 | X | Y |
| Database | 🟢/🟡/🔴 | X | Y |
| Testing | 🟢/🟡/🔴 | X | Y |
| Data Isolation | 🟢/🟡/🔴 | X | Y |
| Dependency Hygiene | 🟢/🟡/🔴 | X | Y |
| API Compat | 🟢/🟡/🔴 | X | Y |
| Time Handling | 🟢/🟡/🔴 | X | Y |

**Overall Health**: 🟢 Good / 🟡 Needs Attention / 🔴 Action Required

### Status Legend
- 🟢 **Good**: No critical issues, minor warnings acceptable
- 🟡 **Needs Attention**: Has warnings or non-critical issues
- 🔴 **Action Required**: Has critical issues that must be fixed

### Critical Findings (Must Fix)

| # | Category | Issue | File | Line | Severity |
|---|----------|-------|------|------|----------|
| 1 | Security | SQL injection | file.rb | 45 | CRITICAL |
| 2 | Resilience | No timeout | adapter.rb | 67 | HIGH |

### Warnings (Should Fix)

| # | Category | Issue | File | Impact |
|---|----------|-------|------|--------|
| 1 | Code Smells | Oversized module | user.rb | Maintenance |
| 2 | Performance | In-memory filter vs. datastore query | service.rb | Query waste |

### Recommendations (Priority Order)

1. **[CRITICAL]** Fix SQL injection in X (security)
2. **[HIGH]** Add timeouts to external service calls (resilience)
3. **[MEDIUM]** Refactor User module — 450 lines (code smells)
4. **[LOW]** Update 3 outdated dependencies (dependency hygiene)

### Trends (vs Previous Audit)

| Metric | Previous | Current | Trend |
|--------|----------|---------|-------|
| Oversized modules (>200 lines) | 12 | 14 | ⬆️ +2 |
| Missing indexes | 3 | 1 | ⬇️ -2 |
| Current-time calls outside allowed helper | 5 | 2 | ⬇️ -3 |
```

## Category-Specific Invocation

When called with a specific category argument:

### `/codebase-audit security`
Run only Phase 1 security checks + full deep-dive (matching project skill, or manual). If domain compliance applies (e.g. payment code), also run the matching compliance skill.

### `/codebase-audit performance`
Run only Phase 1 performance checks + full deep-dive.

### `/codebase-audit code-quality`
Run only Phase 1 code smells checks + full deep-dive.

### `/codebase-audit resilience`
Run only Phase 1 resilience checks + full deep-dive.

### `/codebase-audit database`
Run only Phase 1 database checks + full deep-dive.

### `/codebase-audit testing`
Run `/tdd` (+ any fixture/factory-optimization skill) on recent tests + validate test patterns against `stack.md#test-conventions`.

### `/codebase-audit isolation`
Run only Phase 1 data-isolation checks + full deep-dive.

### `/codebase-audit dependencies`
Run full dependency-hygiene deep-dive (matching project skill, or the commands in `stack.md#audit-checks`).

### `/codebase-audit api`
Run full API-compatibility deep-dive on the changed API surface.

### `/codebase-audit time`
Run only Phase 1 time-handling checks + full deep-dive.

---

## Linting After Findings

If this audit surfaces code changes, lint the modified files per `../shared/stack.md#commands` before committing.

(Ruby/Rails example — illustrates the shape of a filled-in `stack.md#commands` lint entry; the actual command for a real project lives in that project's stack.md)
```bash
bin/d bundle exec pronto run -r rubocop -c develop -f text
```

---

## Related Skills

This skill orchestrates whatever project-specific analyst skills exist for each category — see `../shared/stack.md#analysts` and the CLAUDE.md skill router for the current mapping. Where no matching skill exists for a category, this skill performs that category's deep-dive itself, using `stack.md#audit-checks` as its starting point. `/tdd` is dojo's own testing-quality skill and is always invoked for the Testing category regardless of what other analyst skills exist.

**Integration**: `/orchestrate` can call `/codebase-audit` as part of pre-release validation.

---

## Kaizen Log

Archived to [`kaizen_log.md`](kaizen_log.md) in this directory. To record a new improvement, append a row there — do not self-edit this file during an audit run.
