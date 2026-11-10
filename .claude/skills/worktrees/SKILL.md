---
name: worktrees
description: Use when starting feature work that needs isolation from the current workspace, or before executing an implementation plan. Ensures an isolated workspace exists via the harness's native worktree tool, or a git worktree fallback under `.claude/worktrees/` when none is available.
disable-model-invocation: true
---

<!-- Ported from obra/superpowers skills/using-git-worktrees — MIT License, Copyright (c) 2025 Jesse Vincent. Adapted to dojo conventions. -->

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Worktrees

## Overview

Ensure work happens in an isolated workspace. Prefer the harness's native worktree tools. Fall
back to manual `git worktree` only when no native tool is available.

**Core principle:** Detect existing isolation first. Then use native tools. Then fall back to
git. Never fight the harness.

**Announce at start:** "I'm using the worktrees skill to set up an isolated workspace."

## Step 0: Detect Existing Isolation

**Before creating anything, check if you are already in an isolated workspace.**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside git submodules. Before
concluding "already in a worktree," verify you are not in a submodule:

```bash
# If this returns a path, you're in a submodule, not a worktree — treat as normal repo
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**If `GIT_DIR != GIT_COMMON` (and not a submodule):** You are already in a linked worktree. Skip
to Step 2 (Project Setup). Do NOT create another worktree.

Report with branch state:
- On a branch: "Already in isolated workspace at `<path>` on branch `<name>`."
- Detached HEAD: "Already in isolated workspace at `<path>` (detached HEAD, externally managed).
  Branch creation needed at finish time."

**If `GIT_DIR == GIT_COMMON` (or in a submodule):** You are in a normal repo checkout.

Has the user already indicated their worktree preference in your instructions? If not, ask for
consent before creating a worktree:

> "Would you like me to set up an isolated worktree? It protects your current branch from
> changes."

Honor any existing declared preference without asking. If the user declines consent, work in
place and skip to Step 2.

## Step 1: Create Isolated Workspace

**You have two mechanisms. Try them in this order.**

### 1a. Native Worktree Tools (preferred)

The user has asked for an isolated workspace (Step 0 consent). Do you already have a way to
create a worktree? It might be a tool with a name like `EnterWorktree`, `WorktreeCreate`, a
`/worktree` command, or a `--worktree` flag, if one exists — use it and skip to Step 2.

Native tools handle directory placement, branch creation, and cleanup automatically. Using
`git worktree add` when you have a native tool creates phantom state your harness can't see or
manage.

Only proceed to Step 1b if you have no native worktree tool available.

### 1b. Git Worktree Fallback

**Only use this if Step 1a does not apply** — you have no native worktree tool available. Create
a worktree manually using git.

#### Directory Selection

Follow this priority order. Explicit user preference always beats observed filesystem state.

1. **Check your instructions for a declared worktree directory preference.** If the user has
   already specified one, use it without asking.

2. **Check for an existing project-local worktree directory:**
   ```bash
   ls -d .claude/worktrees 2>/dev/null   # dojo default (colocated with other .claude/ tooling state)
   ls -d .worktrees 2>/dev/null          # alternative convention some harnesses/projects prefer
   ls -d worktrees 2>/dev/null           # alternative (unhidden)
   ```
   If exactly one is found, use it. If more than one exists, `.claude/worktrees` wins ties.

3. **If there is no other guidance available**, default to `.claude/worktrees/` at the project
   root — dojo's own convention, colocated with other `.claude/` tooling state.

#### Safety Verification (project-local directories only)

**MUST verify the directory is ignored before creating a worktree:**

```bash
git check-ignore -q .claude/worktrees 2>/dev/null || git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:** add the entry to `.gitignore` yourself, then hand off to `/commit` for the
actual commit — this skill edits the file but never commits on its own (no skill commits without
`/commit`'s explicit approval gate).

**Why critical:** Prevents accidentally committing worktree contents to the repository.

**Note on the `.gitignore` entry's form:** whichever of the three candidates above you add
(`.claude/worktrees`, `.worktrees`, or `worktrees`), it must have **no trailing slash**. A
directory-only pattern (e.g. `.claude/worktrees/`) only matches once that path exists on disk —
the check above runs *before* the worktree directory is created, so a trailing-slash pattern
would falsely report "not ignored" and this step would append a duplicate entry every time. If
you ever see a trailing slash on any of these three entries in `.gitignore`, that is the bug, not
a style choice — fix the entry instead of adding another one.

#### Create the Worktree

Branch names follow `../shared/stack.md#vcs`'s branching model (shipped default: `type/slug`,
e.g. `feat/x`, `fix/y`).

```bash
# Determine path based on chosen location
path="$LOCATION/$BRANCH_NAME"

git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

**Sandbox fallback:** If `git worktree add` fails with a permission error (sandbox denial), tell
the user the sandbox blocked worktree creation and you're working in the current directory
instead. Then run setup and baseline tests in place.

## Step 2: Project Setup

Run the project's setup command, if it has one, per `../shared/stack.md#commands` (e.g. a
dependency-install or build step). Skip this step entirely if the project defines none — never
guess a language-specific installer that isn't documented there.

## Step 3: Verify Clean Baseline

Run the full test suite per `../shared/stack.md#commands` ("Run full test suite") to ensure the
workspace starts clean.

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

### Report

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| Already in linked worktree | Skip creation (Step 0) |
| In a submodule | Treat as normal repo (Step 0 guard) |
| Native worktree tool available | Use it (Step 1a) |
| No native tool | Git worktree fallback (Step 1b) |
| `.claude/worktrees/` exists | Use it (verify ignored) |
| `.worktrees/` or `worktrees/` exists (no `.claude/worktrees/`) | Use it (verify ignored) |
| Multiple candidates exist | `.claude/worktrees` wins ties |
| None exist | Check instruction file, then default `.claude/worktrees/` |
| Directory not ignored | Add to `.gitignore`, hand off to `/commit` |
| Permission error on create | Sandbox fallback, work in place |
| Tests fail during baseline | Report failures + ask |
| No documented setup command | Skip setup step |

## Common Mistakes

### Fighting the harness

- **Problem:** Using `git worktree add` when the platform already provides isolation
- **Fix:** Step 0 detects existing isolation. Step 1a defers to native tools.

### Skipping detection

- **Problem:** Creating a nested worktree inside an existing one
- **Fix:** Always run Step 0 before creating anything

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always use `git check-ignore` before creating a project-local worktree

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Follow priority: explicit instructions > existing project-local directory > default
  `.claude/worktrees/`

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

## Red Flags

**Never:**
- Create a worktree when Step 0 detects existing isolation
- Use `git worktree add` when you have a native worktree tool (e.g., `EnterWorktree`). This is
  the #1 mistake — if you have it, use it.
- Skip Step 1a by jumping straight to Step 1b's git commands
- Create a worktree without verifying it's ignored (project-local)
- Skip baseline test verification
- Proceed with failing tests without asking
- Commit a `.gitignore` fix yourself — hand off to `/commit`

**Always:**
- Run Step 0 detection first
- Prefer native tools over the git fallback
- Follow directory priority: explicit instructions > existing project-local directory > default
- Verify the directory is ignored for project-local worktrees
- Run the project's documented setup command, if any, per `../shared/stack.md#commands`
- Verify a clean test baseline per `../shared/stack.md#commands`

## Pressure-Test

RED baseline and GREEN trace: [reference/pressure-test.md](reference/pressure-test.md) (the
skill-creator protocol's documented-baseline form).

## Kaizen: Continuous Improvement

> Improvements log lives in [`kaizen_log.md`](kaizen_log.md).

When you discover a new isolation edge case (e.g. a new native worktree tool, a directory
convention this skill doesn't yet recognize), record it there.
