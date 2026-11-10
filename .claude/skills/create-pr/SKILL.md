---
name: create-pr
description: Use when a work branch is pushed and ready for review, or when the user asks to open a PR — creates pull requests formatted per the project conventions and forge tool registered in stack.md#vcs. Human-gated: propose it, never auto-run.
allowed-tools: [Bash, Read, Grep, Glob, Edit]
disable-model-invocation: true
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

## ⛔ Critical Rules

**NEVER execute `git push` or `gh pr create` without explicit user approval.**

Before pushing or creating PR:
1. Show branch status and commits summary
2. Show proposed PR title and description
3. Ask explicitly: "Ready to push and create PR? (y/n)"
4. **WAIT** for user to respond "y" or "yes"
5. Only then execute git push and gh pr create

---

# Create Pull Request Skill

Create well-formatted pull requests following project standards.

## Process

Precondition: you are on a work branch named per `../shared/stack.md#vcs`'s branching model
(shipped default: `type/slug`), never the base branch — enforced by `/commit`'s branch gate.

1. **Gather context** — `<base>` is the base branch per `../shared/stack.md#vcs`
   ```bash
   git status
   git log <base>..HEAD --oneline
   git diff <base>...HEAD --stat
   ```

2. **Check branch status**
   - Verify branch is pushed to remote
   - If not, push with `-u` flag

3. **Analyze all commits** in the branch (not just the latest)

4. **Thermo gate (recommended)**: for non-trivial diffs, if `/thermo-review` has not run on this
   branch yet, suggest running it before opening the PR — structure feedback is cheapest before
   review. (Manual-only: suggest, never auto-run.)

5. **Create PR** using `gh pr create` with the proper template

## PR Template Format

Use the project's PR template if one exists (`../shared/stack.md#vcs`). Include only relevant sections:

```markdown
**Background**

<1-2 paragraphs explaining business context. A new team member should understand what the PR is about.>

<Optional: Technical context if needed>

**Attention**

* Feature needs to be communicated to staff before merging/Feature can be deployed anytime
* Includes (blocking) migration (create / drop table)
* New to enable `specific_rule` to do something
* A worker or scheduled task used to do something
* Before/after deploy, run a specific operational step

**Pending product confirmation** *(omit this section entirely if there are no open items)*

<Pull the ASSUMED rows from the `grill-me` product-decision ledger (if the project has that
skill) — decisions made without an explicit product sign-off. Declare them so the reviewer sees
them up front instead of discovering them in review.>

* `<decision>` — assumed: `<what you assumed and why>`

**Evidence**

<Author-produced evidence from a real environment, of both the defect and the fix — captures or diagrams.
For a visual change: before/after captures of the same place. Otherwise: failing-then-passing output,
or a query/trace before and after. Always add one happy path capture proving the feature still works.>

Data grounding: <when correctness depends on a data distribution, cite the number here — see Rules>

<details>
  <summary>Screenshot description</summary>

  Collapsible and repeatable section for multiple screenshots
</details>

**Reference**

* [Ticket](<ticket URL, built from the template in ../shared/stack.md#vcs>)
* [Error tracker]()
* [Design Doc]()
```

## Commands

```bash
# Check if branch needs pushing
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "not-pushed"

# Push if needed
git push -u origin $(git branch --show-current)

# Create PR (derive assignee from gh CLI — no hardcoded username; <base> per ../shared/stack.md#vcs)
gh pr create --base <base> \
  --title "TICKET | EMOJI type(scope): Description" \
  --assignee "$(gh api user --jq '.login')" \
  --label "ready for review" \
  --body "$(cat <<'EOF'
## Summary
...
EOF
)"
```

## Rules

- Base branch per `../shared/stack.md#vcs` (do not assume it is the repo's default branch — check)
- Title format per `../shared/stack.md#vcs`; the shipped suggested default is
  `TICKET | EMOJI type(scope): Short description` (gitmoji required where the project convention
  calls for it)
- Extract the ticket key from the branch name where the project uses one
- If `grill-me` ran this session (if the project has that skill) and produced ASSUMED
  (unconfirmed) items in its product-decision ledger, include the "Pending product confirmation"
  section listing them; omit the section when the ledger has no ASSUMED items
- NEVER push without user confirmation
- Include all commits in summary, not just the latest
- Run lint for modified files per `../shared/stack.md#commands` before pushing (preserves legacy
  files' existing style, catches only newly-touched lines)
- Run the project's autofix/format-on-write lint mode ONLY for newly added files, per
  `../shared/stack.md#commands`
- Never use em dashes (—) in outward text the user posts as their own (PR titles/bodies, ticket
  comments, chat drafts). Use commas, colons, parentheses, a period, or restructure the sentence —
  an em dash is a recognizable tell of AI-generated text, and user-signed comms must read as
  human-written. Do a final pass before creating the PR: search the outward text for "—" and
  remove any found.
- Never declare a PR ready with Evidence empty — it needs author-produced before/after or
  failing/passing evidence plus one happy-path capture before the PR opens.
- Grounding a reviewer could ask about goes in the PR body, not only the investigation folder
  (invisible to reviewers): state the number with its population, n, and date on the Evidence
  section's `Data grounding:` line (e.g. "X% of population Y (n=Z) as of <date>"), per
  `/architect`'s Grounding (production data) section.

## Example

```bash
# User runs: /create-pr

# Claude gathers info, then (Ruby/Rails example, base branch and ticket URL per
# ../shared/stack.md#vcs):
gh pr create --base develop \
  --title "CORE-121 | ✨ feat(onboarding): Move hasCompleteProfile to userOnboardingStatus" \
  --assignee "$(gh api user --jq '.login')" \
  --label "ready for review" \
  --body "$(cat <<'EOF'
**Background**

Mobile app needs to track user onboarding progress more efficiently. Currently, profile completion is computed on every request which impacts performance.

This PR moves the check to a dedicated database flag that's updated when profile fields change.

**Attention**

* Feature can be deployed anytime
* No blocking migrations

**Evidence**

Before: profile completion recomputed on every request (trace attached). After: flag read
directly, recomputation removed (trace attached). Happy path: full onboarding flow re-run
end to end, still completes correctly.

Data grounding: 8% of active users (n=4,200) had a stale flag as of 2026-09-01, per the
migration backfill query.

<details>
  <summary>Screenshot description</summary>

  Collapsible and repeatable section for multiple screenshots
</details>

**Reference**

* [Ticket](https://tracker.example.com/browse/CORE-121)
* [Error tracker]()
* [Design Doc]()

EOF
)"
```

---

## Forge Tooling

The forge (PR host) tool is registered in `../shared/stack.md#vcs` — read it there rather than
assuming. The commands shown above are written against `gh` (GitHub), the framework's suggested
default; where `stack.md#vcs` registers a different tool, translate them to its equivalent.

Whatever is registered, the fallback rule is the same: if the session also exposes forge tooling
via MCP, it is a valid alternative for the same operations (create/list/get PRs, check CI status,
link issues) — prefer whichever is actually configured in the session; do not assume a specific
one is present.

**Use Cases:**
- Check for existing PRs before creating
- Auto-add reviewers based on changed files
- Get CI status of PR
- Link PR to issues automatically

Adding reviewers: use `gh pr edit <number> --add-reviewer reviewer1,reviewer2` — do not assume a
dedicated "request reviewers" tool exists without checking what's actually available in the
session.

---

## Kaizen: Continuous Improvement

> Improvements log lives in [`kaizen_log.md`](kaizen_log.md).

When you discover a new PR pattern, missing validation step, or outdated `gh` CLI usage: complete the current PR first, then run `/kaizen` to record the improvement.
