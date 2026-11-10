---
name: finishing-branch
description: Use when implementation is complete, tests pass, and you need to decide how to integrate the work. Presents a gated option menu (merge locally, push and open a PR, keep as-is, or discard) and hands off destructive or publishing steps to `/commit` and `/create-pr` for their own approval gates.
disable-model-invocation: true
---

<!-- Ported from obra/superpowers skills/finishing-a-development-branch — MIT License, Copyright (c) 2025 Jesse Vincent. Adapted to dojo conventions. -->

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Finishing a Branch

## Overview

Guide completion of development work by presenting clear options and handling the chosen
workflow. This skill never publishes or destroys work itself — it decides which of `/commit`,
`/create-pr`, or a locally-gated action applies, and always defers the actual approval gate to
whichever of those owns it.

**Core principle:** Verify tests → Detect environment → Present options → Execute choice → Clean
up.

**Announce at start:** "I'm using the finishing-branch skill to complete this work."

## Step 1: Verify Tests

**Before presenting options, verify tests pass:**

Run the full test suite per `../shared/stack.md#commands` ("Run full test suite").

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

## Step 2: Detect Environment

**Determine workspace state before presenting options:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

This determines which menu to show and how cleanup works:

| State | Menu | Cleanup |
|-------|------|---------|
| `GIT_DIR == GIT_COMMON` (normal repo) | Standard 4 options | No worktree to clean up |
| `GIT_DIR != GIT_COMMON`, named branch | Standard 4 options | Provenance-based (see Step 6) |
| `GIT_DIR != GIT_COMMON`, detached HEAD | Reduced 3 options (no merge) | No cleanup (externally managed) |

## Step 3: Determine Base Branch

Base branch per `../shared/stack.md#vcs` (dojo's shipped default is `master`; check the actual
project value there — do not assume the repo's git default branch matches it).

```bash
git merge-base HEAD <base-branch-per-stack.md#vcs>
```

## Step 4: Present Options

**Normal repo and named-branch worktree — present exactly these 4 options:**

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Detached HEAD — present exactly these 3 options:**

```
Implementation complete. You're on a detached HEAD (externally managed workspace).

1. Push as new branch and create a Pull Request
2. Keep as-is (I'll handle it later)
3. Discard this work

Which option?
```

**Don't add explanation** — keep options concise.

## Step 5: Execute Choice

### Option 1: Merge Locally

Merging and deleting a branch are history-mutating; per dojo's rule, no skill merges, pushes, or
discards work without explicit approval. Get explicit approval from the user before running the
merge — reference `/commit`'s branch gate and this project's branch-first convention rather than
re-asking the same question `/commit` would; do not paste `/commit`'s own gate text here.

```bash
# Get main repo root for CWD safety
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"

# Merge first — verify success before removing anything
git checkout <base-branch>
git pull
git merge <feature-branch>
```

Re-run the full test suite per `../shared/stack.md#commands` on the merged result before
declaring success.

Then: Cleanup worktree (Step 6), then delete branch:

```bash
git branch -d <feature-branch>
```

### Option 2: Push and Create PR

**Do not push directly and do not re-implement the approval gate here — hand off to
`/create-pr`.** `/create-pr` owns the push + PR approval gate end to end; invoke it rather than
running `git push` or `gh pr create` from this skill.

**Do NOT clean up the worktree** — the user needs it alive to iterate on PR feedback.

### Option 3: Keep As-Is

Report: "Keeping branch `<name>`. Worktree preserved at `<path>`."

**Don't clean up the worktree.**

### Option 4: Discard

Discarding permanently deletes work; this is the most destructive option and needs its own
unambiguous confirmation, separate from a plain y/n. Require the user to type `discard` (the
literal word, case-sensitive) — not "y" or "yes" — to confirm:

```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for the exact typed confirmation. A plain "y" or "yes" does NOT count for this option.

If confirmed:
```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

Then: Cleanup worktree (Step 6), then force-delete branch:
```bash
git branch -D <feature-branch>
```

## Step 6: Cleanup Workspace

**Only runs for Options 1 and 4.** Options 2 and 3 always preserve the worktree.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

**If `GIT_DIR == GIT_COMMON`:** Normal repo, no worktree to clean up. Done.

**Provenance check — only clean up worktrees this framework created.** If `$WORKTREE_PATH` is
under `.claude/worktrees/` (dojo's default worktree location, per the `/worktrees` skill), this
framework created it — we own cleanup:

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git worktree remove "$WORKTREE_PATH"
git worktree prune  # Self-healing: clean up any stale registrations
```

**Otherwise:** The host environment (harness) owns this workspace, or it was created outside
`.claude/worktrees/`. Do NOT remove it. If your platform provides a workspace-exit tool, use it.
Otherwise, leave the workspace in place.

## Quick Reference

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | yes (after explicit approval) | - | - | yes |
| 2. Create PR | - | via `/create-pr` | yes | - |
| 3. Keep as-is | - | - | yes | - |
| 4. Discard | - | - | - | yes (typed confirmation) |

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create a failing PR
- **Fix:** Always verify tests before offering options

**Open-ended questions**
- **Problem:** "What should I do next?" is ambiguous
- **Fix:** Present exactly 4 structured options (or 3 for detached HEAD)

**Cleaning up the worktree for Option 2**
- **Problem:** Removes the worktree the user needs for PR iteration
- **Fix:** Only clean up for Options 1 and 4

**Deleting the branch before removing the worktree**
- **Problem:** `git branch -d` fails because the worktree still references the branch
- **Fix:** Merge first, remove worktree, then delete branch

**Running `git worktree remove` from inside the worktree**
- **Problem:** Command fails silently when CWD is inside the worktree being removed
- **Fix:** Always `cd` to the main repo root before `git worktree remove`

**Cleaning up harness-owned or non-`.claude/worktrees/` workspaces**
- **Problem:** Removing a worktree this framework didn't create causes phantom state
- **Fix:** Only clean up worktrees under `.claude/worktrees/` (provenance check, Step 6)

**Re-implementing `/commit` or `/create-pr`'s approval gate**
- **Problem:** Two skills asking a slightly different version of the same y/n question is a new
  sync surface — if one gate's wording changes, this skill's copy silently drifts out of date
- **Fix:** Point at `/commit` and `/create-pr` by name for their gates; never paste their gate
  text here

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require the typed `discard` confirmation, not a plain y/n

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without explicit approval, or without verifying tests on the merged result
- Delete work without the typed `discard` confirmation
- Force-push without an explicit request
- Remove a worktree before confirming merge success
- Clean up worktrees you didn't create, or that live outside `.claude/worktrees/`
  (provenance check)
- Run `git worktree remove` from inside the worktree being removed
- Push directly or call `gh pr create` from this skill — that is `/create-pr`'s gate, not this
  skill's

**Always:**
- Verify tests before offering options
- Detect environment before presenting the menu
- Present exactly 4 options (or 3 for detached HEAD)
- Get explicit approval before Option 1's merge
- Get the typed `discard` confirmation for Option 4
- Clean up the worktree for Options 1 & 4 only, and only if it's under `.claude/worktrees/`
- `cd` to the main repo root before worktree removal
- Run `git worktree prune` after removal
- Hand off Option 2 to `/create-pr` rather than pushing directly

## Pressure-Test

RED baseline and GREEN trace: [reference/pressure-test.md](reference/pressure-test.md) (the
skill-creator protocol's documented-baseline form).

## Kaizen: Continuous Improvement

> Improvements log lives in [`kaizen_log.md`](kaizen_log.md).

When you discover a new integration edge case (a new base-branch detection quirk, a harness that
needs a different cleanup tool), record it there.
