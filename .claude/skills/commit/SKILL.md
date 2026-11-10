---
name: commit
description: Use when changes are staged and ready to be committed, or when the user asks to commit — creates conventional git commits formatted per the project standards in stack.md#vcs. Human-gated: propose it, never auto-run.
allowed-tools: [Bash, Read, Grep, Edit]
disable-model-invocation: true
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

## ⛔ Critical Rules

**NEVER execute `git commit` without explicit user approval.**

Before committing:
1. Show staged changes summary
2. Show proposed commit message
3. Ask explicitly: "Ready to commit? (y/n)"
4. **WAIT** for user to respond "y" or "yes"
5. Only then execute `git commit`

---

# Git Commit Skill

Create well-formatted git commits following the project's conventional commit standards.

## When to Use

Run `/commit` manually whenever you are about to execute `git commit`. It is a **hard gate** — do not commit without:
1. On a work branch, never the base/protected branch (see Branch gate below, per `../shared/stack.md#vcs`)
2. Lint clean on changed files (per `../shared/stack.md#commands`)
3. Commit message formatted per `../shared/stack.md#vcs`
4. Explicit user approval (see Critical Rules above)

## Process

1. **Branch gate (MUST, first check)**
   ```bash
   git branch --show-current
   ```
   If the current branch is the base branch or any protected branch (per `../shared/stack.md#vcs`),
   **STOP** — do not lint, stage, or commit. Create a work branch named per
   `../shared/stack.md#vcs`'s branching model (shipped default: `type/slug`, e.g. `feat/x`,
   `fix/y`) first, then continue. Never commit directly to a protected branch, no exceptions.

2. **Check current state**
   ```bash
   git status
   git diff --staged
   ```

3. **If no staged changes**, show unstaged changes and ask what to stage

4. **Run lint validation on changed files (BEFORE staging)**

   **CRITICAL**: Run lint checks BEFORE staging files, and BEFORE `git add` — some diff-based
   linters only see unstaged files.

   Run the lint command(s) for changed files per `../shared/stack.md#commands`. If the project
   defines both a fast diff-based check and a full-file check, run BOTH — a diff-based check alone
   can miss issues on lines the diff didn't touch directly (e.g. an alignment rule triggered by a
   change elsewhere on the same line). Use the exec wrapper per `../shared/stack.md#commands` for
   every invocation — never call the bare interpreter/toolchain if the project defines a wrapper.

   **BOTH must pass before proceeding.** If either reports violations, fix and re-run both.

   **Expected output**: No violations from either command

   **If violations found**:
   - Fix all violations
   - Re-run BOTH checks until clean
   - Only then proceed to staging and commit

   **Why run before staging, and why possibly two checks**:
   - A diff-based linter checks only changed lines (can miss issues on continuation/context lines)
   - A full-file linter catches everything the diff-based one might miss
   - Together they catch what CI will flag
   - A pre-commit hook that swallows its own errors is not a substitute for running lint yourself

5. **Analyze changes** to determine:
   - Type: feat, fix, refactor, test, docs, chore, style, perf
   - Scope: affected area
   - Breaking changes

6. **Generate commit message** following the format defined in `../shared/stack.md#vcs`. The
   shipped suggested default (use it unless stack.md overrides it) is:
   ```
   TICKET | EMOJI type(scope): description

   [optional body — 3–5 bullets max, action verbs]

   [optional footer]
   ```

7. **After commit: verify with `git show --stat HEAD`** — confirm only the intended files appear in the output. If any staged file is missing, it was silently dropped by a pre-commit hook; stage it again and create a NEW commit.

## Commit Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `docs` | Documentation only changes |
| `chore` | Maintenance tasks |
| `style` | Formatting, missing semicolons, etc. |
| `perf` | Performance improvement |

## Branch Prefix Convention

Extract the ticket key from the branch name for scope, following the branch-naming convention
in `../shared/stack.md#vcs` (e.g. `feature/<TICKET>-description` → scope includes `<TICKET>`).
If the project has no ticket tracker, omit the ticket segment entirely — see
`../shared/stack.md#vcs` for whether a ticket prefix applies at all.

## Rules

- NEVER commit without explicit user approval
- NEVER use `--no-verify` unless explicitly requested
- NEVER amend commits unless explicitly requested
- Stage specific files, avoid `git add -A` or `git add .`
- Check for sensitive files (.env, credentials) before staging
- NEVER add Co-Authored-By lines or any AI/Claude attribution to commit messages
- **CRITICAL**: NEVER include file lists, test results, or detailed change descriptions in commit messages - git already shows this information

## Example

```bash
# User runs: /commit

# Claude checks status and diff, then proposes (Ruby/Rails example, using the shipped
# suggested default format — check ../shared/stack.md#vcs for this project's actual format):
git commit -m "$(cat <<'EOF'
CORE-121 | ✨ feat(onboarding): Add user profile completion flag

- Add has_complete_profile column to users table
- Update onboarding status logic to use new flag
- Add specs for profile completion scenarios

EOF
)"
```

---

## Kaizen: Continuous Improvement

> "Every day we must improve" - 改善

Full history → [`kaizen_log.md`](kaizen_log.md)

To add a new entry: append to `kaizen_log.md` and, if the lesson changes active behaviour, promote it into the Process steps above.

<!-- Kaizen: 2026-07-09 - User correction -->
- Rule: Branch-first is a precondition of this skill — verify the current branch is a work branch before the first commit; never commit to the base/protected branch directly.
- Why: The framework's own bootstrap landed 17 commits straight on master with no branch or PR; the user flagged gitflow as a working premise, and direct-to-base commits skip the review gates (thermo-review, adversarial-review) this framework exists to enforce.
- How to apply: first gate = `git branch --show-current` vs stack.md#vcs protected list; if on a protected branch, create `type/slug` and continue there.
