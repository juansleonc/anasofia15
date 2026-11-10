---
name: comment-discipline
description: Canonical comment-cut policy — default to cut, allowed exceptions, and the mechanical checks that make the ratio and staleness rules checkable. Shared by code-simplifier.md, /orchestrate Gate 5, and /tdd's self-review axis 7; each consumer adds its own framing on top.
---

# Comment Discipline

> One authoritative copy. Consumers: `code-simplifier.md` (Operating rule 4), `/orchestrate` (Gate
> 5), `/tdd` self-review axis 7. Each consumer adds its own framing on top; the policy below is
> shared.

1. **Trigger** — applies to every diff; re-run before every commit to a branch with an open PR,
   review-fix commits included.

2. **Comments default to cut.** Code explains itself through naming and structure. Write no new
   prose comment unless it states a fact the code cannot: an external contract, a surprising
   real-world data shape, a measurement that justifies a design choice, why a guard exists when its
   reason lives elsewhere, or protection against a vacuous assertion.

3. **Carve-outs.** Tool-required directives (pragmas, lint suppressions, license headers, and any
   file header this language's convention mandates) and project-sanctioned debt markers are not
   prose and are exempt from the cut. Never re-add a comment the user deleted.

4. **The mechanical checks**, run on the diff against the merge base (per
   [Diff Scope](../shared/diff-scope.md)):
   1. Compute the ratio of added comment lines to added non-blank code lines — cut hard above ~20%.
   2. Each rationale appears once: grep its key term across the diff and keep it only where the
      decision is made.
   3. A test comment that paraphrases the test's own name → delete.
   4. A comment that restates a constant or function name → delete.
   5. After editing code, re-read the surviving comments above it for staleness.
   6. No contract/ticket ID or other session-artifact token survives in a comment (see
      [Forbidden Patterns — Session artifacts in committed code](../shared/forbidden-patterns.md)).
   7. No dead/commented-out code block survives.
   8. Any file header this language's convention requires is present (carve-out 3 exempts it from
      the cut; this checks it wasn't dropped).
   Report the ratio.
