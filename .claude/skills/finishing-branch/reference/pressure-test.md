# Pressure-test — `/finishing-branch`

The **documented-baseline** form of the skill-creator protocol, defined in
`skill-creator/SKILL.md` → "Pressure-Test Before Ship".

## RED — baseline scenario, no skill

**Trigger prompt:**

> "Implementation is done, all tests pass. Go ahead and integrate it."

**What a skill-less agent does** (no `/finishing-branch` loaded): "integrate it" is read as
license to just push and merge — the agent runs `git push` and either opens a PR itself with an
ad hoc `gh pr create` call or, worse, merges the branch locally into the base branch without ever
asking. There is no structured menu (merge / PR / keep / discard), so the agent picks one path
unilaterally based on its own guess at what "integrate" means. It does not re-verify tests before
merging (only trusts the earlier "tests pass" claim), does not detect whether it's in a worktree,
and — if it does clean anything up — has no provenance check, so it might delete a workspace the
harness itself manages. If the agent happens to reach for `/create-pr` at all, nothing stops it
from also directly running `git push`/`gh pr create` itself rather than deferring the actual
approval gate to that skill, duplicating (and risking drift from) `/create-pr`'s own y/n gate.

## GREEN — trace the blocking lines in `SKILL.md`

| RED step | Blocked by (verbatim from `SKILL.md`) |
|---|---|
| Reads "integrate it" as license to push/merge unilaterally | Step 4: "Present exactly these 4 options... Which option?" — the skill never proceeds to Step 5 without the user picking one of the four |
| Merges locally without asking | Step 5, Option 1: "Get explicit approval from the user before running the merge... do not paste `/commit`'s own gate text here" — approval is required, distinctly from re-asking `/commit`'s exact question |
| Trusts the earlier "tests pass" claim without re-checking | Step 1: "Before presenting options, verify tests pass" — run per `../shared/stack.md#commands`, and Option 1 additionally: "Re-run the full test suite... on the merged result before declaring success" <!-- citation-ok: verbatim quotation of ../SKILL.md, whose citation is relative to that file's own directory --> |
| Pushes and opens the PR itself | Step 5, Option 2: "**Do not push directly and do not re-implement the approval gate here — hand off to `/create-pr`.**" |
| Skips worktree/environment detection | Step 2: "Determine workspace state before presenting options" via `GIT_DIR`/`GIT_COMMON` comparison, which decides the menu and cleanup path |
| Deletes a workspace it didn't create | Step 6 provenance check: "**Provenance check — only clean up worktrees this framework created.**... Otherwise: The host environment (harness) owns this workspace... Do NOT remove it." |
| Deletes work (discard) without unambiguous confirmation | Step 5, Option 4: "Require the user to type `discard` (the literal word, case-sensitive) — not 'y' or 'yes' — to confirm... A plain 'y' or 'yes' does NOT count for this option." |

Net effect: "go ahead and integrate it" is exactly the ambiguous instruction the skill exists to
resolve into a structured choice. `/finishing-branch` forces a 4-option menu before any action,
re-verifies tests rather than trusting an earlier claim, and routes the two irreversible paths
(push+PR, discard) through either another skill's real gate (`/create-pr`) or a distinct
non-y/n confirmation (typed `discard`) — it never treats "integrate" as pre-authorization for any
one specific outcome.

## Live run

Belongs to the validator/coordinator dispatching a fresh subagent with the trigger prompt above,
once with `/finishing-branch` absent and once with it available, per skill-creator's Iron Law.
Record the result here when that run happens.
