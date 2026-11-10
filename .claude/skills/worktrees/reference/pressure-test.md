# Pressure-test — `/worktrees`

The **documented-baseline** form of the skill-creator protocol, defined in
`skill-creator/SKILL.md` → "Pressure-Test Before Ship".

## RED — baseline scenario, no skill

**Trigger prompt:**

> "Start isolated feature work on the new hook script — I don't want it touching my current
> branch."

**What a skill-less agent does** (no `/worktrees` loaded): it either (a) stays in the current
checkout and creates a new branch there with `git checkout -b`, which does NOT satisfy "isolated
from current workspace" (the working tree is still shared — a mid-flight `git status`/`git diff`
from the user's own session would see the agent's changes), or (b) if it does reach for a
worktree, hardcodes a path (`mkdir tmp-work && git worktree add tmp-work`) without checking
whether the platform already provides native isolation, without checking dojo's own
`.claude/worktrees/` convention, and without verifying the chosen directory is git-ignored before
creating it — exactly the failure mode Common Mistakes documents ("Skipping ignore verification"):
worktree contents get tracked and pollute `git status`. It also has no reason to run a baseline
test pass before starting work, so pre-existing failures get conflated with new ones once work
begins.

## GREEN — trace the blocking lines in `SKILL.md`

| RED step | Blocked by (verbatim from `SKILL.md`) |
|---|---|
| Stays in the current checkout, calls that "isolated" | Step 0: "check if you are already in an isolated workspace" via `GIT_DIR`/`GIT_COMMON` comparison — a normal checkout where they're equal is explicitly NOT isolated, forcing Step 1 |
| Jumps straight to `git worktree add` without checking for a native tool | Step 1a: "Do you already have a way to create a worktree?... If you do, use it... Only proceed to Step 1b if you have no native worktree tool available." |
| Hardcodes an arbitrary directory (`tmp-work`) | Directory Selection priority order: "explicit instructions > existing project-local directory > default `.claude/worktrees/`" — an arbitrary name is neither |
| Creates the worktree without checking `.gitignore` | Safety Verification: "**MUST verify the directory is ignored before creating a worktree**" — a hard blocking `MUST`, not a suggestion |
| Commits the `.gitignore` fix itself | Safety Verification, "If NOT ignored": the skill edits `.gitignore` itself and hands the commit to `/commit` — it never commits on its own |
| Skips the baseline test pass before starting | Step 3: "Run the full test suite per `../shared/stack.md#commands`... to ensure the workspace starts clean... If tests fail: Report failures, ask whether to proceed or investigate." <!-- citation-ok: verbatim quotation of ../SKILL.md, whose citation is relative to that file's own directory --> |
| Assumes a language-specific setup command (`npm install`) | Step 2: "Run the project's setup command, if it has one, per `../shared/stack.md#commands`... Skip this step entirely if the project defines none — never guess a language-specific installer that isn't documented there." <!-- citation-ok: verbatim quotation of ../SKILL.md, whose citation is relative to that file's own directory --> |

Net effect: the trigger prompt asks for isolation from the current workspace. The skill-less
baseline either fakes isolation (same working tree, new branch) or builds real isolation but skips
the ignore-verification safety step and hardcodes both the directory and the setup/test commands.
`/worktrees` forces the Step 0 detection first (so a harness with native isolation is never
double-isolated), the MUST-verify-ignored gate before ever running `git worktree add`, and routes
every stack-specific command through `../../shared/stack.md#commands` instead of a guess.

## Live run

Belongs to the validator/coordinator dispatching a fresh subagent with the trigger prompt above,
once with `/worktrees` absent and once with it available, per skill-creator's Iron Law. Record the
result here when that run happens.
