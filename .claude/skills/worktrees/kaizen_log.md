# Kaizen Log — worktrees

> Append improvement entries here (date, what changed, why).

- 2026-09-05: `.gitignore` and `templates/gitignore.snippet` shipped
  `.claude/worktrees/` with a trailing slash (a directory-only pattern, which
  only matches once the path exists on disk). Two symptoms: `tests/test_worktrees_router_gitignore.sh`
  failed whenever run from inside a linked worktree (the directory doesn't
  exist there), and — more seriously — the skill's own Safety Verification
  check-ignore probe (SKILL.md) ran before the worktree directory existed, got
  a false "not ignored", and appended a duplicate entry to `.gitignore` on a
  fresh clone. Fixed by dropping the trailing slash in both gitignore files
  (matches whether or not the path exists yet, no change needed to the
  check-ignore invocation itself) and adding a regression test that replays
  the skill's exact probe line against a throwaway repo.

- 2026-09-05 (follow-up, validator finding): the regression test above counted
  occurrences of the fixed pattern (`grep -c '^\.claude/worktrees$'`) after
  running the probe, and asserted the count was 1. That count is anchored to
  the fixed pattern's exact text, so it is blind to the defect it exists to
  catch: seed the throwaway repo with the PRE-FIX entry
  (`.claude/worktrees/`, trailing slash) and the anchored grep matches zero
  lines to begin with — appending the fixed-form duplicate still brings the
  count to exactly 1, and the assertion prints OK while a line was, in fact,
  appended. Fixed by diffing the whole `.gitignore` against the pre-probe seed
  instead of counting a specific line: the real invariant is "the skill's
  probe must not modify a correctly-configured .gitignore," which holds
  regardless of which pattern form (slash or no slash) is under test. Verified
  the corrected assertion goes RED against a pre-fix seed and GREEN against
  the shipped one, and reproduced it end-to-end in a standalone scratch copy
  with the trailing slash reintroduced in both `.gitignore` and
  `templates/gitignore.snippet` — the suite catches the reintroduced defect
  through this behavioral assertion, not only through the two literal-line
  greps.

  Also: the trailing-slash note this test guards was written only for the
  `.claude/worktrees` candidate, but SKILL.md's Safety Verification probes
  three candidates in order (`.claude/worktrees`, `.worktrees`, `worktrees`)
  — a project using the `.worktrees/` convention would hit the identical
  duplicate-append defect with no warning. Reworded the note to cover all
  three candidates generically.

  Separately investigated (not changed, `install.sh` is out of this write
  set): existing installs never receive either of the fixes above, because
  `install.sh`'s `.gitignore` block only checks whether its marker is already
  present (`grep -qF "$GITIGNORE_MARKER_START" "$GITIGNORE"`) and skips
  entirely if so — it never re-syncs content, unlike the `dojo:router` block
  in `CLAUDE.md`, which diffs the extracted block against the template and
  re-emits it on drift (`replace_router_block`, gated by
  `has_router_markers`). A comment at `install.sh` (near the CLAUDE.md
  section) calls the `.gitignore` block "the same idiom as" the router
  block's marker re-sync, but the implementation is not the same idiom: one
  is content-diffed, the other is presence-only. This reads as a bug relative
  to that comment's own stated intent, not a deliberate design choice — flagged
  for a maintainer decision on whether `--update` should re-sync the
  `.gitignore` block the same way it re-syncs the router block.

- 2026-09-05: Closed the flag above — `install.sh`'s `.gitignore` block now
  re-syncs on `--update` instead of skipping on marker presence alone, so the
  trailing-slash correction actually reaches already-installed projects
  (before this, dojo could ship a snippet fix that no existing target would
  ever receive). The block follows the router block's shape: extract the span
  between the markers, compare it to `templates/gitignore.snippet`, replace in
  place on drift, SKIP when identical. Everything outside the markers survives
  byte-identical, including a missing final newline when the block sits at EOF.
  Markers are matched as whole lines and must form exactly one ordered pair —
  an unpaired, reversed or duplicated set is reported `NOTICE` and left
  untouched, because every way of "repairing" it guesses at a boundary in a
  file the project owns. A plain install stays additive; `--update` is the
  opt-in to re-syncing content already on disk, as it is for the router block.
  Covered by `tests/test_install_gitignore_resync.sh`.

- 2026-09-05: Hardened that re-sync against targets whose `.gitignore` is not a
  clean LF text file. A block whose marker lines carry a trailing CR — what
  git's own recommended Windows setting (`core.autocrlf=true`) and a
  `text eol=crlf` attribute both produce, and `install.sh` runs under Git Bash —
  was being classified `corrupt`, so the operator was told to hand-repair a
  healthy file and the block could never be re-synced on that target at all.
  Marker matching now strips a trailing CR before comparing, in one shared awk
  fragment used by the state scan, the extractor and the writer so the three
  can never disagree about where a block starts, and the rewritten block is
  emitted in the line-ending convention the target's file already uses rather
  than converting it: dojo owns the block's content, not the project's line
  endings. The "no marker matched, but the text appears somewhere" fallback was
  narrowed to "a marker line with its surrounding whitespace trimmed" — as
  written it re-admitted exactly what whole-line anchoring exists to exclude and
  withheld the block forever from a fresh target whose file merely mentioned the
  marker text in a longer line. The state scan moved from `grep` to `awk`
  because a NUL byte anywhere in the file puts grep into binary mode, where the
  step produced no record line at all; an explicit `unknown` state plus a
  default `case` arm now make a state that cannot be classified impossible to
  pass silently. `UPDATE` is recorded only after the rewrite lands, so a
  read-only `.gitignore` is reported rather than announced-then-aborted.

- 2026-09-05: Known limitation, deliberately NOT fixed — the in-sync comparison
  (`"$(extract_gitignore_block ...)" == "$(render_gitignore_snippet ...)"`)
  runs through command substitution, which strips trailing newlines on both
  sides. A block that differs from the canonical snippet ONLY by trailing blank
  lines therefore compares equal, reports `SKIP` on every `--update`, and never
  converges to the shipped content. It is inert content-wise (a trailing blank
  line in a `.gitignore` ignores nothing) and it is inherited verbatim from the
  `CLAUDE.md` router block's own comparison, which has the identical property.
  Fixing it here alone would diverge the two idioms that the rest of this work
  went out of its way to keep in step, so it is recorded as a limitation shared
  by both marker blocks and should be fixed for both together or not at all.

- 2026-09-05 (follow-up): the same lie the `ok`/UPDATE arm was fixed against
  survived one arm away, in `absent`/INSTALL. `record INSTALL` ran before the
  `{ ... } >> "$GITIGNORE"` append, so a read-only `.gitignore` with no dojo
  block got `INSTALL` recorded, the append then failed, and `set -e` aborted
  the install before the summary printed — a report claiming a delivery that
  never landed, on top of a run that never finished. Reshaped to match the
  `ok` arm: the append's own exit status gates the record (`elif { ... } >>
  "$GITIGNORE"; then record INSTALL ... else record NOTICE ...`), so a failed
  append is reported and the install completes rather than dying under `set
  -e`. Covered by `tests/test_install_gitignore_resync.sh` fixture (n), the
  `absent`-path sibling of fixture (m)'s `ok`-path coverage — same three
  assertions (install finishes, the unwritten block is not reported as
  INSTALL, the summary still prints), same read-only-file caveat (skipped
  under root, which reads/writes through `chmod 000`/`444` regardless).

- 2026-09-05 (mutation-testing follow-up, APPROVE WITH NOTES closure): 21
  mutants were built against the re-sync logic above; 16 died, 5 survived. Four
  of the five got a dedicated assertion (the fifth — NOTICE not surfaced in the
  final summary table — was judged non-blocking and left as-is). All four
  surviving mutants trace to the same root cause, not four independent misses:
  the suite is one-fixture-per-property (fixture (h) covers CRLF, fixture (i)
  covers the marker lookalike, fixture (n) covers absent+read-only), so no
  fixture exercises two properties at once and every cross-product between
  them is structurally blind. Substring-matching mutants in
  `extract_gitignore_block`/`gitignore_block_eol` survived because the one
  fixture with a lookalike (i) never ran a second `--update`, and the one
  fixture that is CRLF (h) never carried a lookalike; a re-terminate mutant in
  `replace_gitignore_block` survived because (h) was uniformly CRLF, so
  normalizing every line to the block's own convention was invisible until (h)
  also carried a mixed-EOL line. Closing all four took planting the LOOKALIKE
  fixture into (h) itself (now shared between both fixtures) rather than
  adding disjoint assertions — the fix *is* the cross-product, not four
  separate patches.

  Two more items surfaced but were intentionally left unfixed, per the
  validator's scope:
  - Two assertions in this suite hardcode `record`'s exact
    `printf '%-8s %s\n'` padding (the `UPDATE   .gitignore` /
    `INSTALL  .gitignore` literals). Load-bearing today, but a future
    format-string change to `record` would make both pass vacuously forever
    without ever re-checking the thing they claim to check. A regex form
    (`UPDATE +\.gitignore`, already used elsewhere in this same file) would be
    durable against that; these two are not, and should be converted the next
    time this file is touched.
  - Under `root`, the `chmod 000`/`444` fixtures short-circuit to a skip
    message, which silently un-verifies two of this branch's own guards (the
    unknown-state default `case` arm, and the record-before-append ordering).
    There is no CI configuration in this repo today to confirm these run
    unprivileged in practice.

  Also recorded, not acted on (explicitly out of scope): the lone-CR
  (classic-Mac line ending) case, a byte-order-mark/`strcoll` portability
  note, and a gawk-vs-BSD-awk divergence on how a leading byte-order mark
  interacts with marker matching (macOS's BSD awk treats it as
  collation-ignorable; gawk likely does not) — all theoretical or
  environment-dependent, and the shipped-on-Windows awk is specifically the
  untested one.
