---
name: diff-scope
description: Canonical answer to "what changed" for a gate that runs BEFORE the work is committed — the working tree AND the index against the merge base, plus the untracked files no git diff will ever show — in three named variants (content, files, lines). Also names the one post-commit case where `<base>...HEAD` is still correct. Shared by every skill and agent that scopes itself to a diff; each consumer adds its own framing on top.
---

# Diff Scope

> One authoritative copy. Each consumer adds its own framing on top; the scope definitions below
> are shared and are not to be restated by consumers — cite this file instead of paraphrasing it.
>
> Consumers: `/adversarial-review`, `/coverage`, `/orchestrate`, `/tdd`, `validator.md`, `code-simplifier.md`, `confirm-loop-gate.md`, `comment-discipline.md`.

Nearly every gate here scopes itself to "what changed". Getting that scope wrong does not produce a
wrong answer — it produces a confident answer about nothing. An empty diff reviews clean.

## Why `<base>...HEAD` is the wrong question before a commit

Three-dot diffs the merge base against **`HEAD`** — that is, against *committed* work only. It says
nothing about the working tree.

**Pre-commit, `git diff <base>...HEAD` is empty.** Committing and opening a PR are the LAST phase
of the pipeline, and the commit step is human-gated, so every gate that runs before it — the
validator, the code simplifier, an adversarial review, the confirm loop, patch coverage, a worker's
own pre-handoff self-check — runs while nothing has been committed yet. Hand any of them
`<base>...HEAD` and they review an empty diff and report clean.

**`git diff` never lists untracked files**, in any form, two-dot or three-dot. A file a worker just
created is invisible to every gate above unless untracked files are enumerated by a separate
command — and a brand-new file is exactly where unreviewed content concentrates. Enumerate them
every time; never infer them from a diff.

## The base point

Compare against the **merge base**, not the base branch tip. The base branch may have moved since
this branch was cut, and diffing against its tip attributes other people's commits to this change.

```bash
BASE="$(git merge-base <base branch (stack.md#vcs)> HEAD)"
: "${BASE:?no merge base with the base branch — shallow clone? run: git fetch --unshallow (or --deepen=N) and retry}"
```

The second line is not decoration. With no merge base — a `--depth 1` CI checkout, an orphan
branch, an unborn `HEAD` — `git merge-base` exits non-zero, `BASE` is empty, and every command
below degrades to `git diff ''` → `fatal: ambiguous argument ''`, which names neither the cause nor
the fix. The guard aborts on the spot and says what to do.

`git diff "$BASE"` — two-dot, no `HEAD` on the right — then means "merge base → **working tree**".
That is the pre-commit analogue of three-dot: same left-hand side, but the right-hand side is what
is actually on disk.

**It does not read the index.** `git diff <commit>` compares that commit to the working tree and
ignores staged content entirely. Content that was `git add`ed and then reverted on disk is invisible
to it — and still ships on the next commit, because the commit is built from the index, not from
disk. A populated index is the *normal* state at gate time, not an exotic one: a new file has to be
added before tooling that reads tracked files can see it. So pair every working-tree query with its
`--cached` counterpart, "merge base → **index**", in each variant below.

`git status --short` is the cheap cross-check that the two ever diverge: its first column is the
index, its second the working tree, and `??` marks an untracked path. It is anchored on `HEAD`, not
on the merge base, so it will *not* list a path whose only change is in a commit already made on
this branch. Read it as a divergence detector, never as a replacement for the queries below.

## The three variants

Cite the variant you need by name. Do not invent a fourth; extend this list instead.

Each variant has three queries because a change lives in three places — working tree, index,
untracked. Run all three. The first two overlap far more than "sometimes": they report the same path
whenever it differs from the merge base on both sides. For the **path lists** of variant `files` —
the one place the overlap has to be de-duplicated — that is every path already committed on this
branch, plus every staged path that still differs from the merge base on disk, whether or not it was
touched again after staging. Only two classes come back once: a path changed in the working tree and
never staged, and a path staged and then reverted on disk. Measured on a branch carrying all five
classes at once, 3 of the 5 paths came back twice — an 8-line concatenation for 5 distinct paths.
Duplication is the rule here, not an edge case; size the de-duplication below accordingly. In the
**patch** forms (variants `content` and `lines`) the path repeats just the same, but its two hunks
differ whenever the index and the working tree do, so there the repetition carries information
instead of inflating a count.

The overlap is deliberate, and not for lack of an alternative. A non-overlapping partition exists —
`git diff --cached "$BASE"` (merge base → index) followed by a bare `git diff` (index → working
tree) — and it keeps the merge-base anchor, the patch form and the exact same path coverage. It is
rejected for a different reason: its second half is anchored on the **index**, so a line that was
staged and then reverted on disk renders as `file | 1 -`, which a skimming reviewer reads as "this
change deletes that line" when the line is in the index and ships on the next commit. A duplicated
path is a cheaper defect than a misleading anchor. De-duplicate where duplication would corrupt a
count (variant `files`); never trade the anchor away to avoid it.

**A consumer that inlines these commands instead of citing them inherits three obligations.**
First, every inlined fence must carry the `: "${BASE:?...}"` guard — on a runnable line, above the
first query that uses the value — because an unset `$BASE` makes each query print nothing and a gate
whose output is empty reads CLEAN, the same fail-open this fragment exists to kill, one level down.
A guard named in a comment, commented out, or placed below the queries it protects is not a guard.
Second, every working-tree query must keep its `--cached` sibling; dropping one re-creates the index
blindness described above inside the copy. Third, a fence that unions the path-list queries must
keep its `sort -u`.

All three are mechanically checkable, and worth checking — but only over what a checker can see,
and what it can see is a closed set of fence labels: `bash`, `sh`, `shell`, `console` — the label
alone, with nothing after the label. Put the commands in a fence tagged with one of those four. Any
other opener drops out of every rule silently: `zsh`, `fish`, an untagged fence, or one of the four
carrying an info-string suffix (`bash title=example`). The suffix is the one that bites — it still
reads as bash, so the author believes the fence is covered while it is invisible to every check.
And spell the base as a guarded variable. `git diff "$(git merge-base <base branch> HEAD)"` is the
tempting one-line compaction of the two-line idiom under *The base point* above, and it cannot carry
the guard at all — there is no variable left to guard.

### Variant `content` — everything that changed, as a patch

For a reviewer that must read the change.

```bash
git diff "$BASE"                                  # tracked: merge base → working tree
git diff --cached "$BASE"                         # tracked: merge base → index (the line above skips it)
git diff "$BASE" --stat                           # the working-tree surface, as a summary
git diff --cached "$BASE" --stat                  # the index surface, as a summary
git ls-files --others --exclude-standard          # untracked: the new files, listed
git diff --no-index /dev/null <untracked-file>    # untracked: shown as an all-added patch
```

`--no-index` exits 1 whenever the two sides differ, exactly as `diff(1)` does. That is the normal
outcome here, not a failure — do not let a `set -e` wrapper read it as one.

Both stat lines matter to a consumer that hands the summary onward as the *definition of scope* —
`/adversarial-review` pastes it into every lens prompt and then demotes anything outside it to
NOTES. A stat missing its index side scopes the reviewer out of a staged-only file, so a real defect
there is filed as pre-existing.

### Variant `files` — the list of changed paths

For anything that iterates over changed files: coverage targets, router-glob matching, lint scope.

```bash
{
  git diff --name-only "$BASE"
  git diff --cached --name-only "$BASE"
  git ls-files --others --exclude-standard
} | sort -u
```

`sort -u` over the union is required, not cosmetic. The first two queries overlap (see above), so a
consumer that iterates the raw concatenation visits the overlapping paths twice — and a patch-coverage
denominator summed over that list double-counts every committed and every untouched-since-staged file.

### Variant `lines` — the changed line numbers inside one file

For anything that must map changes to line numbers, such as patch coverage.

```bash
git diff --unified=0 "$BASE" -- <file> | grep "^@@"
git diff --cached --unified=0 "$BASE" -- <file> | grep "^@@"
git diff --no-index --unified=0 /dev/null <untracked-file> | grep "^@@"
```

`--no-index` exits 1 here for the same reason it does in variant `content` above — the sides differ,
which is the normal outcome — and it *will* abort a `set -eo pipefail` wrapper if you let it.

Parse the `@@ -a,b +c,d @@` hunks into line numbers in the new file. **An untracked file has no
hunk header** of its own — the third command manufactures one (`@@ -0,0 +1,N @@`) by diffing the
file against `/dev/null`, because every line in it is a changed line. Handle that case explicitly,
or the newest file in the change silently falls out of the loop as "no hunks, nothing to check".

## The one case where three-dot is right

Once the work is committed and the question becomes "what will this PR contain", `git diff
<base>...HEAD` is the correct query and this fragment does not apply: an uncommitted or untracked
file is by definition not in the PR, and three-dot correctly excludes commits that landed on the
base branch in the meantime. `/create-pr` is that case. Do not "fix" it to the pre-commit form.

## Known gaps

Recorded here rather than under any one consumer, because a gap in this fragment is read by every
file on the `Consumers:` line at the top and a log filed under one skill is not somewhere the others
look. `shared/` carries no `kaizen_log.md`; this section is its substitute.

- **Variant `lines` prescribes no merge rule for its two hunk lists.** Variant `files` says `sort -u`;
  variant `lines` says nothing about how the working-tree and `--cached` hunk sets combine when both
  report the same file. Their union over-reports changed lines, which is the safe direction for a
  coverage denominator and is what `/coverage` — the only `lines` consumer today — should do until a
  rule is written. But no rule is written, so each consumer invents one. Fix it here, not in a
  consumer.
