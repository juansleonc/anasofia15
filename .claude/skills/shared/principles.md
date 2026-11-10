# Engineering principles

Consumers: `/tdd`, `/architect`, `/adversarial-review`, `worker.md`, `validator.md`, `code-simplifier.md`; each cites a principle by its anchor and adds its own framing on top.

This is the one declared set of engineering principles dojo holds itself to and ships to every
project that installs it. It is the canonical home: a consumer cites a principle's anchor here and
never restates it.

## How to read this document

Every principle has two layers, kept in different files:

- **Invariant (Layer 1)** — one sentence in this file, stated over what a change observably does:
  what it does with an input it does not recognize, what a reviewer can ask of it, what its
  references look like, whether its proof can be run again. An invariant names no language
  construct, so it holds in any stack and can be applied with nothing else to hand.
- **Expression (Layer 2)** — how the invariant looks in one particular stack. It never lives here.
  Each principle ends with a single code-span pointer to the anchor in the project's own stack
  documents where that expression lives.

A candidate is admitted only if it passes all three gates:

1. **Language-free** — its invariant can be stated without naming a language construct.
2. **Mechanizable or falsifiable** — it becomes either (a) a mechanical check over structure-only
   artifacts, or (b) a review lens carrying exactly one question with a checkable answer.
3. **Earned** — a real incident in this repository's history already justifies it, cited by
   `file:line` or commit.

Seven principles are admitted: six mechanical and one review lens. Candidates that failed a gate are
listed under [Rejected](#rejected) with the gate they failed; that list is kept longer than the
admitted set on purpose, because it is what stops the set from growing by vocabulary.

## Existing installs

The per-stack expressions are the project's own answers, and they arrive through `/stack-sync`. An
update of an existing install delivers this file and every invariant in it, and appends each stack
section this file defers to as an unanswered TODO prompt, after the project's existing answers and
without changing them. It never writes an answer and never touches `best-practices.md`, so it will
not deliver the expressions themselves. Until `/stack-sync` fills the prompts in, the invariants
stand alone and a deferral pointer below leads to a TODO.

## P1 — Fail closed on unrecognized input
<!-- consumed by: /adversarial-review -->

**Invariant:** when a change receives an input outside the set it recognizes, it refuses with a
failing outcome and a message naming that input, and never carries on as if the input were valid.

- **Axis:** both
- **Classification:** (a) mechanical — `[fail-closed]` reports argument dispatch with no refusing
  catch-all. It does not extend to empty scopes: the audit run's own empty-scope refusal fires only
  when nothing at all is tracked in its scope, and only some checks refuse OK over their own.
- **Incident:** `install.sh:143-147` refuses an unknown flag, and `evals/lib.sh:905-909` and
  `evals/lib.sh:993-996` refuse an unrecognized outcome label, as of `d52f8c6` — the same rule
  implemented in two places and declared in none. The audit's own citation-cycle detector was then
  written to avoid a utility that reports success on the very input it exists to reject.
- **Layer 2:** `stack.md#fail-closed`

## P2 — Semantic stability: a test is proven only by a witnessed failure
<!-- consumed by: /tdd, validator.md -->

**Invariant:** when the meaning of the code changes, at least one test fails; a test that stays green
after the behavior it names has been removed proves nothing.

- **Axis:** both
- **Classification:** (a) mechanical — the mutate, watch it fail, revert ritual is a procedure any
  reviewer can re-run against any test, and the TDD skill's statement of it is pinned by a scripted
  test so the doctrine cannot quietly regress again.
- **Incident:** `validator.md:30` already refused a green test with no witnessed failure, while
  `tdd/SKILL.md:339` shipped the practice as optional and out of scope, as of `d52f8c6` — shipped
  doctrine weaker than the repository's own grading practice. A mutation tool is an optimization of
  this invariant, not a prerequisite for it.
- **Source:** the Mutation Testing post, https://blog.cleancoder.com/uncle-bob/2016/06/10/MutationTesting.html
- **Layer 2:** `stack.md#semantic-stability`

## P3 — Disclosure, including what was deliberately not acted on
<!-- consumed by: worker.md, code-simplifier.md -->

**Invariant:** every hand-off states (i) what remains uncertain and (ii) what was observed and
deliberately not acted on, so that restraint leaves a trace instead of a silence.

- **Axis:** both
- **Classification:** (a) mechanical — `[disclosure-slots]` requires both items in every agent's
  return format and in the investigation template's exit bar.
- **Incident:** `worker.md:37` as of `d52f8c6` — the implementing agent was told to stay in scope,
  and its return format had a slot for open risks but none for an out-of-scope observation it chose
  not to act on, so the observation had nowhere to go. Clause (ii) is where the Boy Scout Rule lands
  (see [Absorbed](#absorbed)).
- **Layer 2:** `stack.md#disclosure`

## P4 — Acyclic references that resolve to something that ships
<!-- consumed by: /architect -->

**Invariant:** following citations from any document ends at a document that states its rule itself;
no chain of citations returns to where it started, other than a detail document's breadcrumb back up
to a skill that links down to it, and every cited path resolves to something that ships.

- **Axis:** inbound
- **Classification:** (a) mechanical — `[ref-cycles]` reports a citation loop, exempting only that
  breadcrumb back-edge, and `[links]` reports a citation that dangles or points at a file that will
  not ship.
- **Incident:** until `1cec416` the link checker could not see the code-span citation form at all;
  widening it surfaced four citations no reader could follow and three citation loops. Cutting the
  loops deleted real pointers, so `07d039a` restored them and taught `[ref-cycles]` the breadcrumb
  exemption. One of them, `memory-conventions.md:80` and `investigation/SKILL.md:170` as of
  `d52f8c6`, still cites in both directions by design: the skill links down to the document that
  states the rule, and the document links back up to the skill that executes it.
- **Layer 2:** `stack.md#acyclic-references`

## P5 — One canonical home per rule
<!-- consumed by: /architect -->

**Invariant:** each rule is stated in exactly one place, and every other place that needs it points
there instead of repeating it.

- **Axis:** both
- **Classification:** (a) mechanical — `[duplicate-blocks]` reports any long run of words shared by
  two shipped files, with no allowlist.
- **Incident:** `check_fallback_line()` at `qa_audit.sh:1313` as of `d52f8c6` pinned one
  three-sentence fallback passage, byte-identical, across 20 skill files — an audit that certified
  the copies stayed synchronized instead of removing them.
- **Layer 2:** `stack.md#canonical-home`

## P6 — Repeatable proof
<!-- consumed by: /tdd -->

**Invariant:** every claim that a change works reduces to a proof that someone else can run again
later and get the same verdict; an observation made once is not a proof.

- **Axis:** both
- **Classification:** (a) mechanical — `[repeatable-proof]` requires every shipped script to be named
  by a test. It is a regression guard: it was green when it landed.
- **Incident:** `a7d47d9` — the audit's portability to an older shell interpreter had rested on a
  syntax pass that could not see the failure; the fix made it a scripted assertion that actually runs
  the audit under that interpreter.
- **Scope:** this generalizes the repeatability of the hand-off gate, not its stronger bar. A hand-off
  executable must still be run locally before it is handed over, per
  `../shared/executable-handoff-gate.md`; this principle does not weaken that. Source: The
  Programmer's Oath, promise 3.
- **Layer 2:** `stack.md#repeatable-proof`

## P7 — An honest estimate is not an enforced ceiling
<!-- consumed by: /adversarial-review -->

**Invariant:** a number produced as a prediction is never enforced as a limit; where a limit is
needed, it is derived from the prediction with stated headroom, and the actual figure is recorded so
the prediction can be checked against it.

- **Axis:** both
- **Classification:** (b) review lens — the deliberate exception: the one admitted principle with no
  mechanical surface, because whether a number is a forecast or a bound cannot be read off its text.
  The lens: "is this number a prediction or a limit, and where is the other one?"
- **Incident:** `evals/lib.sh:262-269` as of `d52f8c6` describes the cut-off this fixes — passing a
  raw cost estimate straight through as the enforced budget cut runs off mid-flight — and
  `evals/lib.sh:270` is the fix: the enforced cap becomes the estimate times a stated headroom
  multiplier (`evals/lib.sh:274`). The case listing at `evals/lib.sh:333` prints the worst-case
  ceiling for every listed case — the sum, across all cases, of each case's own cap times its
  calls-per-attempt — never a single per-call cap, and each run records its actual spend in its
  evidence summary (`evals/lib.sh:724-726`: session, judge and combined cost). Nothing compares the
  actual spend against the ceiling; spotting an overrun is left to the reviewer this lens equips.
- **Layer 2:** `stack.md#estimates`

## Rejected

Each entry names the gate it failed. Book-only sources are cited by title; none has a post to link.

- **Dependency Inversion**, and the SOLID bundle adopted wholesale — fails gate 1.
  Its invariant cannot be stated without an abstraction construct, and the scripting language dojo's
  own payload is written in has no such mechanism, so dojo could declare it but never practice it.
  Source: *Clean Architecture* (book).
- **Transformation Priority Premise** — fails gate 1, and is the worked example of a correct
  rejection. Its content is an ordered list of language constructs; with them stripped nothing
  remains, and its lens form cannot be answered without the list.
- **Stable Dependencies Principle (SDP)** — fails gate 2. Inbound reference counts are computable, but
  no failing threshold is defensible: counting citing files versus citing occurrences keeps the
  ranking and swings the magnitude about fourfold. A number nobody can act on trains readers to skim
  audit output; computability is not mechanizability. Source: *Clean Architecture* (book).
- **Common Reuse Principle (CRP)** — fails gate 3. The only candidate application, splitting the stack
  document by concern, has no incident behind it. Source: *Clean Architecture* (book).
- **Common Closure Principle (CCP)** — fails gate 2. Whether two things will change for the same
  reason is a forecast, not a structure-only fact, and has no checkable answer at review time.
  Source: *Clean Architecture* (book).
- **Stable Abstractions Principle (SAP)** — fails gate 1. Its measure counts abstract constructs
  against concrete ones, which is a count of language constructs. Source: *Clean Architecture*
  (book).
- **The nested cycles of TDD beyond red, green, refactor** — fails gate 3. The longer cycles are real,
  but this repository practices one cycle and has no incident or check behind the others; naming
  four where one is practiced would be vocabulary. Source: The Cycles of TDD post.
- **Screaming Architecture** — fails gate 3. A layout that announces its domain is sound advice, but
  no incident here traces back to a layout that hid its intent, and no structure-only check follows.
  Source: The Screaming Architecture post.

## Absorbed

Two candidates were cheaper to absorb than to declare:

- **Reuse/Release Equivalence (REP)** — passes the gates only as an edge classification, not as a
  standalone rule: it is the UNSHIPPED outcome of `[links]` and the "resolves to something that
  ships" clause of P4. Source: *Clean Architecture* (book).
- **The Boy Scout Rule** — fails gate 3 as a standalone principle. Cleaning only already-touched code
  is already the rule; the incident was a disclosure gap, so it is clause (ii) of P3. Source: *Clean
  Code* (book).
