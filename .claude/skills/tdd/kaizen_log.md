# Kaizen Log — tdd

> Append improvement entries here (date, what changed, why).

<!-- Kaizen: 2026-09-05 -->
**Assertion quality: an assertion its own subject's documentation can satisfy is not an assertion.**
`tests/test_diff_scope.sh` pinned `sort -u` against a whole section slice that held both the command
fence and the paragraph explaining why `sort -u` is required — so deleting `| sort -u` from the
fence kept the suite green. Pins on a command now read the awk-extracted FENCE, never the section,
and a companion `assert_not_contains` fails if the extraction ever widens back to the prose. The
detector rules the same suite ships were hardened alongside: the `: "${BASE:?...}"` guard must sit
on a non-comment line above the first use (a comment naming it, the guard commented out, and the
guard moved below the queries all passed before), `${BASE}` and an inline `$(git merge-base ...)`
now count as consuming the merge base, and every shell fence label is scanned rather than ```bash
alone. Each fix was proven by mutating a scratch copy and watching the suite go red.

Deferred, deliberately not acted on in that pass — recorded so they are not rediscovered from
scratch:
1. **The evasion surface is not proven bounded.** Probed: variable spelling, comment position,
   statement order, fence label, line continuation. Not enumerated: `git --no-pager diff`,
   `--cached=` forms, heredoc-embedded fences, and fences inside `reference/` or `examples.md`
   subfiles (the suite header already concedes the subfile glob gap for the `Consumers:` derivation).
2. **Cosmetic:** self-review axis 7's trigger check prints its "comments touched" message twice when
   a comment exists in both the working tree and the index, because the working-tree and `--cached`
   lines each `echo`.

A third deferred item was filed here and does not belong here: variant `lines` has no prescribed
merge rule for its two hunk lists. That is a gap in `shared/diff-scope.md`, whose only `lines`
consumer is `/coverage` — an author revisiting /coverage Step 1 has no reason to read /tdd's log. It
now lives in a `Known gaps` section inside the fragment itself, reachable from the `Consumers:` line
every consumer arrives through. `shared/` having no `kaizen_log.md` is what sent it here; route the
next one the same way.

<!-- Kaizen: 2026-09-05 --> The union-fence non-vacuity identity needles (`assert_contains ... "/.claude/skills/tdd/SKILL.md:"`) are FILE-level, not fence-level: an assertion named for one union fence (axis 8's) is satisfied by any other union fence's violation-scan output landing in the same file. Not reachable today — verified exactly one union fence exists per file in scope — but the same shape one notch down from the "pin scoped to its subject" lesson above: a second union fence added to the same file (e.g. a future axis 9) would make the axis 8 identity needle vacuous again without the suite noticing. Fix shape: assert the emitted `FILENAME:START` pair (the line number `base_fence_violations()` already prints), not just the filename.

<!-- Kaizen: 2026-09-05 --> The closed fence-label set (```bash`/```sh`/```shell`/```console`) still admits no detection for a NEW fence opened with a label carrying a suffix, e.g. ` ```bash title=x `. Every EXISTING fence in scope is identity-pinned (per the lesson above), so relabelling one of those is caught; a brand-new fence opened this way from day one never enters any rule and nothing reports its absence. Closable with one inverse assertion: no file under `.claude/` or `templates/` may open a fence matching ` ```(bash|sh|shell|console)\S ` (a label character immediately followed by a non-whitespace suffix character, i.e. the label plus something glued onto it with no separating space).
