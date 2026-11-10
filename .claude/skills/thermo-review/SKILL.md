---
name: thermo-review
description: Extremely strict, manual-only post-implementation maintainability and structure audit — abstraction quality, giant files/components, spaghetti-condition growth, and ambitious code-judo simplification. Invoke ONLY on explicit request ("thermo review", "thermo-nuclear review", "deep maintainability audit"); never auto-triggers and is not wired into any router.
disable-model-invocation: true
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.
>
> **⚠️ Confirm-first, never auto-run.** Routed as **confirm-first** (Tier 2) in the project skill router: suggested before `/create-pr` on non-trivial diffs, never auto-run. Not in the auto-invoke tier — do not move it there.

# Thermo-Nuclear Code Quality Review

Use this skill for an unusually strict review focused on implementation quality, maintainability, abstraction quality, and codebase health — adapted from Cursor's `thermo-nuclear-code-quality-review`, generalized to run against any stack via `.claude/skills/shared/stack.md`.

Above all, be **ambitious** about code structure. Do not merely identify local cleanup opportunities. Actively search for "code judo" moves: restructurings that preserve behavior while making the implementation dramatically simpler, smaller, more direct, and more elegant.

## When to Use This vs the Sibling Review Skills

| Skill | Question it answers | Trigger |
|---|---|---|
| `/adversarial-review` | Does this change actually work — can I construct a failure? | Auto-fires on correctness-sensitive diffs |
| `/codebase-audit` | Is the whole repo healthy — security, performance, resilience, data isolation, dependency hygiene, and more? | Manual / periodic health check |
| `code-simplifier` agent | Is this diff's code as clean as it can be *without changing behavior* — semantically-equivalent cleanup? | Dispatched by `/orchestrate` as a Quality-phase agent |
| **`/thermo-review`** | Is this implementation the SIMPLEST correct structure, or did we settle? | **Manual only** — invoke explicitly |

Run this AFTER correctness is already green — typically right after `/adversarial-review` passes and right before `/create-pr`. It does not re-litigate correctness (`/adversarial-review`'s job), it does not audit whole-repo health across security/performance/resilience/etc. (`/codebase-audit`'s job), and it operates at a different altitude than the `code-simplifier` agent's semantically-equivalent diff cleanup (this skill asks whether the *structure itself* should change, not just whether the existing structure is tidy). It exists to ask one question those three don't: *did we settle for "it works" when a materially simpler structure was available?*

## Core Prompt

Start from this baseline:

> Perform a deep code quality audit of the current branch's changes.
> Rethink how to structure/implement the changes to meaningfully improve code quality without impacting behavior.
> Work to improve abstractions, modularity, reduce spaghetti code, improve succinctness and legibility.
> Be ambitious — if there is a clear path to improving the implementation that involves restructuring some of the codebase, go for it.
> Be extremely thorough and rigorous. Measure twice, cut once.

## Non-Negotiable Standards

0. **Be ambitious about structural simplification.** Don't stop at "this could be a bit cleaner." Look for opportunities to reframe the change so whole branches, helpers, or layers disappear entirely. Prefer the solution that feels inevitable in hindsight. Assume a code-judo move is often available — a reorganization that uses the project's canonical layers and abstractions more effectively (per CLAUDE.md / the architecture the codebase already has: services, policies, modules, bounded packages — whatever this project calls them; Ruby/Rails example: `ApplicationService`, `Interactor`, CanCanCan Ability or `action_policy`, existing concerns/scopes). If you see a path to delete complexity rather than rearrange it, push hard for that path.

1. **Do not let a PR push a file from under 1k lines to over 1k lines without a very strong reason.** Applies to any source file — class, module, or frontend component (Ruby/Rails example: models, services, controllers, and pack frontend components — `.es6.jsx`, `packs/*/app/javascript/**`). Treat crossing the threshold as a strong smell by default. Prefer extracting helpers, sub-components, or dedicated modules instead of letting a file sprawl. If the diff crosses that line, explicitly ask whether it should be decomposed first. Only waive this with a compelling structural reason and a clearly organized result.

2. **Do not allow random spaghetti growth in existing code.** Be highly suspicious of new ad-hoc conditionals, scattered special cases, or one-off branches inserted into an unrelated file. "Weird if statements in random places" is a design problem, not a stylistic nit. Prefer pushing the logic into a dedicated abstraction — a service, a policy object, a state machine, or a separate module (Ruby/Rails example: a service object, a CanCanCan Ability or `action_policy` policy) — instead of tangling an existing path. Call out changes that make the surrounding code harder to reason about even if they technically pass tests.

3. **Bias toward cleaning the design, not just accepting working code.** If behavior can stay the same while the structure becomes meaningfully cleaner, push for the cleaner version. Do not rubber-stamp "it works" implementations that leave the codebase messier. Strongly prefer simplifications that remove moving pieces over refactors that merely spread the same complexity around (e.g. moving a fat conditional from one layer into an equally fat sibling layer without reducing branch count — Ruby/Rails example: model into service).

4. **Prefer direct, boring, maintainable code over hacky or magical code.** Treat brittle, ad-hoc, or "magic" behavior as a code-quality problem: reflection-heavy or magic dispatch (Ruby/Rails example: `send`, `define_method`, `method_missing`; non-Ruby parallel: Python string-driven `getattr(obj, name)()` dispatch or JS dynamic bracket-property dispatch) or DSL abuse where a plain `case`/polymorphic method would do. Be skeptical of generic mechanisms that hide simple data-shape assumptions. Flag thin abstractions, identity wrappers, or pass-through services/modules that only delegate to the underlying store or another service without adding clarity.

5. **Push hard on boundary cleanliness when it affects maintainability.** Most languages lack Ruby's exact vocabulary but share the same escape hatches — flag the CATEGORY, not just one language's token: **swallowed errors** (Ruby/Rails example: `rescue nil` / `rescue StandardError => e; nil`; non-Ruby parallel: a bare Python `except: pass`) that discard an error instead of handling it; **optional-chaining/fallbacks that paper over an invariant** (Ruby/Rails example: `&.`/`try(:x)` chains and `presence || default` fallbacks; non-Ruby parallel: a JS `?.` chain or default-coalescing that silently no-ops instead of surfacing why the value is missing) instead of making explicit whether "missing" is a legitimate state or a caller bug; and **ad-hoc dict/hash shapes passed between layers** instead of an explicit type (Ruby/Rails example: a bare `Hash`/`OpenStruct`; non-Ruby parallel: an untyped `**kwargs` blob threaded through several call sites instead of a defined parameter set). If a branch relies on a silent fallback to paper over an unclear invariant, ask whether the boundary should be made explicit instead (raise, explicit nil-check, typed object).

6. **Keep logic in the canonical layer and reuse existing helpers.** Canonical layers are whatever this project's architecture already defines (per CLAUDE.md / the codebase's existing structure: data layer → services (orchestration) → policies (authorization) → bounded modules/packages, whatever this project calls them; Ruby/Rails example: models → services (`ApplicationService`/`Interactor`) → policies (CanCanCan Ability or `action_policy`) → packs, Packwerk-enforced). Call out feature logic leaking into shared data-layer objects, request handlers doing service-layer work, or implementation details leaking across a module/package boundary without a declared dependency. Watch for the "single-consumer shared abstraction" pattern (a mixin/module included by exactly one caller is code-slicing, not shared behavior — Ruby/Rails example: a concern used by only one model) and naming-convention drift at package boundaries (Ruby/Rails example: a pack's new table missing its required prefix is a boundary leak, not a style nit). Prefer existing canonical utilities/services over bespoke one-offs; push code toward the module/service/package that already owns the concept instead of normalizing architectural drift.

7. **Treat unnecessary sequential orchestration and non-atomic updates as design smells when the cleaner structure is obvious.** If independent work is serialized for no good reason (e.g. three unrelated background jobs enqueued and awaited in sequence when they could fan out independently — Ruby/Rails example: Sidekiq jobs), ask whether the flow should be decoupled instead. If related writes can leave state half-applied because they never enter the store's transaction mechanism (Ruby/Rails example: `ActiveRecord::Base.transaction`), push for a more atomic structure — this overlaps with the project's non-negotiable safety rules in CLAUDE.md where one applies (e.g. a financial-transaction rule) but applies here purely as a *design clarity* smell, not just a correctness one. Do not over-index on micro-optimizations, but do flag avoidable orchestration complexity that makes the implementation more brittle.

## Primary Review Questions

For every meaningful change, ask:

- Is there a code-judo move that would make this dramatically simpler?
- Can this be reframed so fewer concepts, branches, services, or modules are needed?
- Does this improve or worsen the local architecture (data layer / service / policy / module)?
- Did the diff add branching complexity where a better abstraction (policy object, state machine, dispatcher) should exist?
- Did a previously cohesive class/module become more coupled, more stateful, or harder to scan?
- Is this logic living in the right layer (data vs service vs policy) and the right module/package?
- Did this change push a source file (class, module, or frontend component) past the 1k-line boundary?
- Are there repeated conditionals that signal a missing domain object, missing policy, or missing service?
- Is the implementation direct and legible, or does it rely on special cases and incidental control flow?
- Is this abstraction (service, module, decorator) actually earning its keep, or is it a pass-through wrapper?
- Did the diff introduce a swallowed error, an optional-chaining fallback, or an ad-hoc dict/hash shape (Standard 5) that obscures the real invariant instead of an explicit contract?
- Is this logic living in the canonical layer, or did the diff leak details across a module/package boundary (undeclared cross-package dependency, naming-convention drift — Ruby/Rails example: an undeclared Packwerk dependency, a missing table prefix)?
- Is this orchestration more sequential or less atomic than it needs to be?

## What to Flag Aggressively

- A complicated implementation where a cleaner reframing could delete whole categories of complexity.
- Refactors that move code around but fail to reduce the number of concepts a reader must hold in their head.
- Any source file (class, module, or frontend component) crossing 1000 lines due to this PR, especially if the new code could be split out.
- New conditionals bolted onto an unrelated data-layer object, request handler, or service method.
- One-off booleans, nullable modes (`skip_*` flags), or feature flags that complicate existing control flow.
- Feature-specific logic leaking into a general-purpose domain object, mixin/module, or shared service.
- Reflection or magic dispatch, or DSL magic (Ruby/Rails example: `send`, `method_missing`, dynamic `define_method`) that hides simple structure.
- Thin service or module wrappers that add indirection without simplifying anything (a shared module used by exactly one caller; a service that only calls the store's update with no orchestration — Ruby/Rails example: `record.update!`).
- A swallowed error, blanket catch-all, or silent fallback (Standard 5) used to muddy a real contract instead of handling the actual missing/error case.
- Copy-pasted logic instead of an extracted helper, scope, or service.
- Narrow edge-case handling implemented in the middle of an already-busy method.
- Refactors that technically pass tests but make the code less modular or less readable.
- "Temporary" branching (a feature-flag `if` with no removal plan) likely to become permanent debt.
- Bespoke helpers where the codebase already has a canonical service/scope/utility for the job.
- Logic added in the wrong module/layer when a clear canonical home already exists.
- Sequential job/service calls where obviously independent work could run decoupled/in parallel.
- Partial-update logic that leaves state less atomic than necessary (writes outside a transaction that should be atomic).

## Preferred Remedies

- Delete a whole layer of indirection rather than polishing it.
- Reframe the state model (enum, state machine, policy object) so conditionals disappear instead of getting centralized.
- Change the ownership boundary so the feature becomes a natural extension of an existing module/service/package.
- Turn special-case logic into a simpler default flow with fewer exceptions.
- Extract a helper, scope, or pure method.
- Split a large file (class, module, or frontend component) into smaller focused files.
- Move feature-specific logic behind a dedicated service object or policy.
- Replace condition chains with a typed model, enum, or explicit dispatcher.
- Separate orchestration (service) from business logic (domain object).
- Collapse duplicate branches into a single clearer flow.
- Delete wrappers (pass-through services/modules) that do not meaningfully clarify the API.
- Reuse the existing canonical service/scope/utility instead of introducing a near-duplicate.
- Make boundaries explicit (raise, explicit nil-check, typed object) so the control flow gets simpler instead of relying on silent fallbacks (Standard 5).
- Move the logic to the module/package/layer that already owns the concept; declare the dependency explicitly (Ruby/Rails example: a Packwerk dependency) instead of reaching across silently.
- Decouple independent work (parallel background jobs — Ruby/Rails example: Sidekiq — non-blocking fan-out) when that also simplifies the orchestration.
- Restructure related updates into a single atomic transaction (Ruby/Rails example: `ActiveRecord::Base.transaction`) when partial state would be harder to reason about.

Do not be satisfied with "maybe rename this" feedback when the real issue is structural. Do not be satisfied with a merely cleaner version of the same messy idea if there is a plausible path to a much simpler idea.

## Review Tone

Be direct, serious, and demanding about quality. Do not be rude, but do not soften major maintainability issues into mild suggestions. If the code is making the codebase messier, say so clearly. If the implementation missed an opportunity for a dramatic simplification, say that clearly too.

Good phrases:

- `this pushes the file past 1k lines. can we decompose this first? (Ruby/Rails example: a class or .es6.jsx component)`
- `this adds another special-case branch into an already-busy method. can we move it behind its own service or policy object?`
- `this works, but it makes the surrounding code more spaghetti. let's keep the behavior and restructure the implementation.`
- `this feels like feature logic leaking into a shared domain object/module. can we isolate it in a service?`
- `this abstraction seems unnecessary — it's a pass-through wrapper around the store. can we just keep the direct call?`
- `why does this swallow the error / fall back silently here? can we make the invariant explicit instead of papering over it?`
- `this looks like a bespoke helper for something the canonical service/utility already does — can we reuse it?`
- `i think there's a code-judo move here that makes this much simpler. can we reframe this so these branches disappear?`
- `this refactor moves complexity around but doesn't really delete it. is there a way to make the model itself simpler?`
- `this module is used by only one caller — is it really shared behavior, or just code-slicing?`
- `this reaches across a module/package boundary without a declared dependency — is this really the right layer for it?`

## Output Expectations

Prioritize findings in this order:

1. Structural code-quality regressions
2. Missed opportunities for dramatic simplification / code-judo restructuring
3. Spaghetti / branching complexity increases
4. Boundary / abstraction / invariant-clarity problems that make the code harder to reason about (swallowed errors, ad-hoc dict/hash shapes, module/package boundary leaks)
5. File-size and decomposition concerns (1k-line threshold, any source file)
6. Modularity and abstraction issues (layer placement, wrapper bloat)
7. Legibility and maintainability concerns

Do not flood the review with low-value nits if there are larger structural issues. Prefer a smaller number of high-conviction comments over a long list of cosmetic notes.

## Approval Bar

Do not approve merely because behavior seems correct. The bar for approval is:

- no clear structural regression
- no obvious missed opportunity to make the implementation dramatically simpler when such a path is visible
- no unjustified file-size explosion (any source file past 1k lines)
- no obvious spaghetti-growth from special-case branching
- no obviously hacky or magical abstraction (reflection/magic dispatch, swallowed errors, ad-hoc dict/hash shapes) that makes the code harder to reason about
- no unnecessary wrapper/pass-through-service/module churn obscuring the real design
- no clear module/package boundary leak or avoidable canonical-service/scope duplication
- no missed opportunity for an obvious decomposition that would materially improve maintainability

Treat these as presumptive blockers unless the author can justify them clearly:

- the PR preserves a lot of incidental complexity when there is a plausible code-judo move that would delete it
- the PR pushes a source file (class, module, or frontend component) from below 1000 lines to above 1000 lines
- the PR adds ad-hoc branching that makes an existing data-layer/handler/service flow more tangled
- the PR solves a local problem by scattering feature checks across shared domain objects/modules
- the PR adds an unnecessary abstraction — a pass-through service, a module with one consumer, or a swallowed-error/ad-hoc-dict contract — that makes the design more indirect
- the PR duplicates an existing service/scope/utility or puts logic in the wrong layer/module when there is a clear canonical home

If those conditions are not met, leave explicit, actionable feedback and push for a cleaner decomposition.

## Relationship to CLAUDE.md Critical Rules

This skill is about **structure**, not correctness or safety — it complements, never replaces, the project's non-negotiable safety rules in CLAUDE.md (and a local `CLAUDE.local.md`, where present). A finding here (e.g. "wrap these related writes in a transaction") may look adjacent to one of those rules where the project has one for data integrity, but this skill flags it as a *design-clarity* smell (atomic vs non-atomic orchestration) even outside that rule's exact scope; the CLAUDE.md rule is the hard, non-negotiable safety requirement. When the two overlap, the CLAUDE.md rule always wins as the non-negotiable floor — this skill pushes past that floor toward the *best* structure, not just a safe one.

## Kaizen: Continuous Improvement

> Improvements log lives in [`kaizen_log.md`](kaizen_log.md).

When you discover a new structural smell worth standardizing, a false-positive pattern, or a sharper remedy: complete the current review first, then run `/kaizen` to record the improvement.

This is a fresh port for this framework (adapted from a sibling project's mature Rails/Packwerk version of this skill). No project-specific Kaizen history yet — start logging as real reviews surface lessons here.
