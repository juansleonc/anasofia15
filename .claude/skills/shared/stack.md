# Stack Adapter — anasofia15 (Astro quinceañera invitation, derived from my15)

> Single source of stack-specific truth for this project. Generalized dojo skills (tdd,
> coverage, codebase-audit, commit, create-pr, orchestrate, adversarial-review, ...) never
> hardcode a stack command — they reference sections of this file by anchor instead.
>
> **MAINTENANCE**: this file is filled in incrementally by `/kaizen` and `/learning` as the
> project's tools are actually exercised. Do not front-load it — let real skill runs discover
> real answers.
>
> Each section is one of:
> - `TODO` — not filled yet. Skills degrade gracefully: ask the user for the answer, use it to
>   proceed, then record it here before finishing so the next run doesn't have to ask again.
> - `N/A` — explicit. A valid, deliberate fill meaning "this does not apply to this project."
>   Do not leave a section blank or silently skip it; write `N/A` and say why in one line.

## Commands

<!-- consumed by: tdd, coverage, worker/validator agents -->

- **Exec wrapper**: none — plain `pnpm <script>` / `pnpm exec <bin>` (pnpm@11.14.0, Node >=22.12).
  Use `pnpm install --frozen-lockfile` to install (never bare `pnpm install` in CI/automation).
- **Run one test file**: `pnpm exec vitest run <path-to-test-file>` (e.g.
  `pnpm exec vitest run src/lib/__tests__/countdown.test.ts`)
- **Run full test suite**:
  - Unit: `pnpm test` (→ `vitest run`)
  - E2e: `pnpm test:e2e` (→ `playwright test`; runs against `pnpm run preview` of the built
    `dist/`, so `pnpm build` must succeed first — Playwright's own `webServer` block starts
    preview automatically). First-time/new-machine setup:
    `pnpm exec playwright install --with-deps webkit` (config only runs a `mobile` /
    iPhone 13 (webkit) project; add `chromium`/other browsers only if the config grows
    projects).
  - Build (also acts as a type-check gate via Astro): `pnpm build` (→ `astro build`)
- **Lint changed files**: `pnpm lint` (→ `eslint . && astro check`; covers both JS/TS lint and
  Astro template diagnostics — no separate per-file lint command observed yet)
- **Lint/format a newly created file**: same as above — `pnpm lint` (no separate single-file
  formatter configured; no Prettier observed in `package.json`)
- **Console / REPL**: N/A — no project REPL script; use `pnpm exec astro ...` subcommands or a
  one-off Node script per below
- **Run a one-off script / ad-hoc code outside the test suite**: `pnpm exec tsx <script>.ts` is
  NOT installed; plain `node <script>.mjs` or a `.ts` file run via `pnpm exec vite-node` has not
  been exercised yet — TODO confirm on first real need. The `scripts/` directory exists in the
  repo (currently empty after the ANASOFIA15 seed copy) as the intended home for these.
- **Establish local state / bring up a local environment with data**: N/A — static site, no
  database/data layer. `pnpm run dev` (astro dev) for local preview during development;
  `pnpm build && pnpm run preview` to preview the production build exactly as e2e/CI see it.

## Test conventions

<!-- consumed by: tdd -->

- **Test locations**:
  | Kind | Directory/glob |
  |---|---|
  | Unit (vitest) | `src/lib/__tests__/*.test.ts` (pure-logic modules under `src/lib/`) |
  | E2e (Playwright) | `e2e/*.spec.ts`, run against the built `dist/` via `pnpm run preview` |
- **Unit / integration / system boundaries**: unit tests (vitest + jsdom) cover pure TS modules
  in `src/lib/` (countdown math, rsvp validation, confetti/base helpers, trivia logic, event
  config) in isolation, no DOM rendering of Astro components. E2e tests (Playwright, `mobile` /
  iPhone 13 project) are the only layer that renders actual Astro components/pages and asserts
  on real DOM/visual/interaction behavior (sections, animations, forms, music, countdown
  display). There is no separate "integration" tier — Astro components are exercised only at
  the e2e layer.
- **Test templates per kind**: no generator; copy the nearest existing file (e.g.
  `src/lib/__tests__/countdown.test.ts` for a new `src/lib/*.ts` unit test, or
  `e2e/countdown.spec.ts` for a new section's e2e spec) and adapt.
- **Fixture / factory policy**: no fixture/factory library — tests construct literal inputs
  inline (plain objects/strings) at the point of use; prefer the same minimal-inline-literal
  style over adding a shared fixture helper.
- **Time handling in tests**: the project is NOT using fake timers broadly — e2e countdown tests
  pass an explicit `countdownTarget` query param / data attribute to control the target instant
  rather than mocking `Date.now()`. **Known gotcha (discovered during ANASOFIA15 Phase 0
  baseline on 2026-11-09)**: `e2e/countdown.spec.ts`'s default/no-override tests assert against
  the real event date hardcoded in `src/data/event.ts`; once that real-world date passes,
  those tests start failing (countdown shows "arrived" instead of counting down) even though
  nothing is broken — this is a time-bomb in the fixture, not a regression. Any new event-site
  clone must keep its real target date comfortably in the future for CI to stay green, or move
  those specific assertions onto an explicit future `countdownTarget` override.
- **Flaky-test triage recipes**: the one flakiness source seen so far is the time-bomb above
  (event date in the past breaks "future" assertions) — confirm by checking today's date against
  `src/data/event.ts`'s target before assuming a real regression. No other flaky patterns
  observed yet.
- **Parallel-safety rules**: Playwright config sets `fullyParallel: true` with a single shared
  `webServer` (one `pnpm run preview` instance on port 4321) — specs run concurrently against
  that one server, so avoid tests that mutate shared server-side state (none exists today; the
  site is fully static/client-side). Vitest runs are single-process, no shared external state to
  contend over.

## Coverage

<!-- consumed by: coverage -->

- **Per-file / per-line coverage command**: TODO
- **Patch-coverage check** (coverage of only the changed lines): TODO
- **CI coverage gates** (thresholds, where they're enforced): TODO

## Audit checks

<!-- consumed by: codebase-audit Phase 1 -->

Fast grep/static checks per category. One or more commands per category, plus what a hit means.

- **Security**: TODO
- **Performance**: TODO
- **Code smells**: TODO
- **Resilience**: TODO
- **Database**: TODO
- **Data isolation**: TODO
- **Dependency hygiene**: TODO
- **Time handling**: TODO

<!--
Example of a filled entry (generic, not stack-specific — adapt the pattern, not the command):

- **Code smells**: `grep -rn "TODO\|FIXME" src/` — unresolved markers left in shipped code;
  triage each hit as either fix-now or file-a-ticket-and-remove-the-marker.
-->

## Analysts

<!-- consumed by: orchestrate Phases 1A/1B -->

Domain/stack analyst skills that exist in THIS project (empty until one is created here).

- (none yet)

## Observability

<!-- consumed by: adversarial-review, investigation, debug workflows -->

- **Error tracker**: TODO
- **Analytics / prod-data oracle**: TODO
- **If none of the above exist**: production-state findings are unverifiable — skills must say
  so explicitly and never fake verification of production behavior.

## VCS

<!-- consumed by: commit, create-pr, all diff-scoped skills -->

- **Base branch**: TODO (suggested default: `main`)
- **Branching model**: TODO (suggested default: branch-first — never commit directly to the base
  branch; work branches `type/slug`; land via PR)
- **Protected branches**: TODO
- **Commit message format**: TODO (suggested default, customizable: ship gitmoji —
  `TICKET | EMOJI type(scope): subject`)
- **Forge / PR tool**: TODO (suggested default: `gh` CLI on GitHub; use your host's
  equivalent otherwise — `glab`, `az repos`, or a forge MCP server. Skills prefer whichever
  is actually configured in the session and must not assume one is present.)
- **Ticket URL template**: TODO
- **PR description template**: TODO (pointer to the template file, if any)

## Forbidden patterns

<!-- consumed by: tdd, coverage, adversarial-review -->

Stack-specific banned patterns for this project. Universal bans that apply to every stack live
in `.claude/skills/shared/forbidden-patterns.md` — do not duplicate them here, only add to them.

- TODO

<!--
Examples of what a stack-specific ban looks like (illustrative only, do not copy verbatim):

- No `SELECT *` in migrations that touch large tables — locks the table longer than necessary.
- No bare `except:` in Python exception handlers — swallows KeyboardInterrupt/SystemExit too.
-->

## Fail closed

<!-- consumed by: principles (P1) -->

- **Refusing an unrecognized option or argument** (this stack's idiom for a catch-all that exits
  non-zero and names the input): TODO
- **Refusing an unrecognized value in a closed set** (a status, mode or label the code branches
  on): TODO

## Semantic stability

<!-- consumed by: principles (P2), tdd -->

- **Breaking a behavior by hand to watch its test fail** (how to mutate the code, run the covering
  test, and revert): TODO
- **Mutation-testing tool** (name and invocation, or `N/A` — its absence never excuses the manual
  check above): TODO

## Disclosure

<!-- consumed by: principles (P3) -->

- **Where a hand-off records what remains uncertain** (a PR template section, a commit body, a
  ticket field): TODO
- **Where a hand-off records what was observed and deliberately not acted on**: TODO

## Acyclic references

<!-- consumed by: principles (P4) -->

- **How documents and code cite each other here** (link syntax, import-path conventions): TODO
- **What detects a dangling or circular reference** (a link checker, a dependency-cycle check):
  TODO

## Canonical home

<!-- consumed by: principles (P5) -->

- **Where a shared rule lives** (the directory or document that is its one home): TODO
- **What detects a duplicated rule or block** (a duplication detector and its threshold, or
  `N/A`): TODO

## Repeatable proof

<!-- consumed by: principles (P6) -->

- **The command that re-runs the proof for a change** (usually the full suite from `## Commands`;
  name any extra check): TODO
- **Where a proof that cannot be automated is recorded** (a manual gate with its exact command
  and expected result): TODO

## Estimates

<!-- consumed by: principles (P7) -->

- **Numbers this project predicts** (cost, time or size budgets) **and the headroom each enforced
  limit derived from one carries**: TODO
- **Where the actual figure is recorded, so the prediction can be checked against it**: TODO
