# Forbidden Patterns

> Universal bans — apply to every stack. Stack-specific bans live in
> `stack.md#forbidden-patterns` (each target project fills its own).

Patterns that MUST be avoided in all code and tests, regardless of language or framework. Each
entry states the ban, why, and a language-agnostic detection hint.

## Session artifacts in committed code

Contract IDs, ticket IDs, and other AI-session bookkeeping (`C1`, `BF-C1`, ticket keys like
`PROJ-623`) must never appear in test names, comments, or identifiers — e.g.
`describe("C6: rejects brackets")` instead of `describe("rejects brackets")`. Also forbidden:
comments narrating the implementation process (what a contract said, what a bot flagged). Seed
scripts, debug output, and scratch files belong in `investigations/`, never in the commit.

**Why**: meaningless to a reader without the session; the mapping belongs in a PR description or
task log. Real reviewer feedback flags this as noise.

**Detection hint**: grep diffs for ticket-key patterns (`[A-Z]{2,}-\d+`) and contract tokens
(`\bC\d+\b`, `\bBF-C\d+\b`) in test names/comments; grep for stray `debug_`/`scratch_`/`seed_tmp`
files outside `investigations/`. For dojo's own shipped payload, mechanically guarded by
qa_audit `[artifacts]`.

## Hardcoded IDs / credentials / environment-specific values

No literal database IDs, API keys, passwords, hostnames, or other environment-specific values in
tests or code — e.g. `create_user(id=1)` or `API_KEY = "sk_live_abc123"` instead of letting the
store generate the id / reading from environment.

**Why**: hardcoded IDs break parallel/repeated test runs and assume database state that may not
exist; hardcoded credentials are a leak waiting to happen; hardcoded env values silently break
outside the environment they were copied from.

**Detection hint**: grep tests for literal int/UUID ids passed to factory calls; grep for
high-entropy literals assigned to `*_KEY`/`*_TOKEN`/`*_SECRET`/`*_PASSWORD`; grep for literal
non-`localhost` hostnames/URLs.

## Sleep-based waits in tests

`sleep(2); assert_visible(element)` instead of polling/awaiting the actual condition
(`wait_until(condition, timeout=5)`).

**Why**: a fixed sleep is either too short (flaky) or too long (slow) depending on machine load —
it guesses at timing instead of checking the real condition.

**Detection hint**: grep tests for `sleep(`/`time.sleep`/`Thread.sleep`/bare `setTimeout` used as
a wait mechanism rather than a polling/await/condition helper.

## Mocking the subject under test

Only mock collaborators (external services, dependencies) — never the object or function under
test itself, e.g. stubbing `user.full_name` and then asserting `user.full_name == "John Doe"`
always passes regardless of the real implementation. If the subject is too entangled with its
dependencies to test without mocking itself, extract the dependency first.

**Why**: a test that mocks its own subject can't fail on a real regression — it tests the mock,
not the code.

**Detection hint**: grep test files for a mock/stub target whose name matches the class/function
the enclosing `describe`/`it` block is testing.

## Swallow-and-ignore error handling

An empty or bare `catch`/`except`/`rescue` (`try { risky() } catch { }`) instead of catching a
specific error and logging or handling it.

**Why**: hides real errors, including bugs and data corruption, until they surface far from the
cause — often in production.

**Detection hint**: grep for empty or no-op-body (`pass`, `{}`, `; end`) catch/except/rescue
blocks with no re-raise, no logging, and no specific exception type.
