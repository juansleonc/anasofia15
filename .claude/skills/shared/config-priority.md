---
name: config-priority
description: Canonical statement of where a skill's configuration lives — project conventions in CLAUDE.md, stack specifics in stack.md — and the TODO-fallback procedure for a stack answer that is not yet recorded. Cited by every skill's own "Config Priority" line; none restates it.
---

# Where Configuration Lives

> One authoritative copy. Consumers: every `SKILL.md`'s own "📋 Config Priority" line. Each
> consumer cites this file instead of restating it — see `check_duplicate_blocks()` in
> `qa-audit/qa_audit.sh`.

## Config Priority

Project conventions live in `CLAUDE.md` (a local `CLAUDE.local.md`, where present, overrides it).
Stack specifics live in `.claude/skills/shared/stack.md`. If a section you need is TODO there: ask
the user, use the answer, and record it in stack.md before finishing.

**↳ TODO fallback (all skills)**: before asking, scan up to 3 relevant artifacts (lockfile,
config, CI) and propose the fill with its evidence (`file:line` or source URL) for the user to
confirm; only ask outright if nothing grounds it. Record the confirmed answer. For a full stack
pass, run `/stack-sync`.
