# Kaizen Log — qa-audit

> Append improvement entries here (date, what changed, why).

<!-- Kaizen: 2026-08-30 -->
**"Project-owned" and "does not ship" are two different boundaries — only the second one may
narrow an audit scope.** Check [artifacts] hard-failed an installed project because its own
stack.md cross-references its own validation contracts in parenthesised shorthand, a shape
pattern (a) matches. The first fix excluded install.sh's whole project-owned set, which looked
principled because that set is already named in one place. It was wrong: that set governs
`--update`, where the files are preserved, but on a FRESH install the log stubs are delivered
verbatim, so a leak in one of them would ship to every new target. Verified by running a real
fresh install and comparing the delivered files against dojo's own — stack.md is seeded from the
template and best-practices.md is never seeded, while the log stubs are byte-identical copies.
Only the first two left the scan scope. The general rule for any scope-narrowing on this audit:
prove the file's dojo-side copy never reaches a target before excluding it, and pin the near-miss
with assertions that go red if the exclusion is later widened to a directory, basename or glob
match — and pin the install-side guarantee the exclusion rests on, so the two cannot drift apart.
