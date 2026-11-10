---
name: return-status
description: Canonical definition of the four values a hand-off reports so its caller can branch — DONE, DONE_WITH_CONCERNS, BLOCKED, NEEDS_CONTEXT. Meant to be shared by every skill that reports a hand-off status (see this file's own Consumers line for those that do); each consumer adds its own framing on top.
---

# Return Status

> One authoritative copy. Each consumer adds its own framing on top; the four definitions below
> are shared and are not to be restated by consumers — cite this file instead of paraphrasing it.
>
> Consumers: `/tdd`, `/architect`.
>
> One gloss predates that rule: `orchestrate/SKILL.md` still paraphrases `NEEDS_CONTEXT` inline
> rather than citing this file. Removing it is owned by open PR #16, not by this file.

A caller branches on this value, so report it verbatim, as exactly one of four:

- **`DONE`** — every assertion the task named is satisfied and you hold the evidence for each.
  Nothing was narrowed, deferred, or assumed. `DONE` is a claim about evidence you hold, not a
  claim that you stopped working.
- **`DONE_WITH_CONCERNS`** — the work is complete and the evidence holds, but you are handing the
  caller something it must decide about: a weaker check than you wanted, a case you could not
  cover, an assumption you had to make. Name each concern in one line. **This is the rung the
  default skips.** A partial success reported as `DONE` is the failure this vocabulary exists to
  prevent; silence about a concern is not the same as its absence, and the caller cannot ask about
  a concern it was never told existed.
- **`BLOCKED`** — you could not complete the work, and no answer from the caller would change that:
  a failing dependency, a missing permission, an environment that will not come up. State what
  stopped you and what would unblock it.
- **`NEEDS_CONTEXT`** — you hit genuine ambiguity you cannot resolve alone, and an answer from the
  caller WOULD unblock you. Ask rather than guess.

**`BLOCKED` vs `NEEDS_CONTEXT` turn on one test — would an answer from the caller unblock you?
Yes → `NEEDS_CONTEXT`. No → `BLOCKED`.**

Status is orthogonal to the evidence ladder a validator grades contracts on. The ladder grades how
well ONE contract is known; the status above reports the outcome of the WHOLE hand-off. Reporting
one honestly never substitutes for the other — a `DONE` whose contracts sit at the weakest rung is
still a `DONE` the validator will reject.
