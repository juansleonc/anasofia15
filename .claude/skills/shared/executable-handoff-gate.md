---
name: executable-handoff-gate
description: Canonical gate for any hand-off executable — an artifact a human operator or a live environment will execute as-is (a console/ops command sequence, a one-off data fix, a phased runbook, a migration/rollback command block). Shared by /tdd, validator.md, worker.md, and /architect; each adds its own framing on top.
---

# Executable Handoff Gate

> One authoritative copy. Consumers: `/tdd` (author-time trigger + classification), `validator.md`
> (evidence-ladder grading), `worker.md` (pre-handoff self-check), `/architect` (design-doc command
> blocks). Each consumer adds its own framing on top; the gate mechanics below are shared.

1. **Trigger** — ask: will a human, or a live environment, execute this artifact as-is? A
   console/ops command sequence, a one-off data-fix or backfill invocation, a phased runbook, and
   a migration/rollback command block written into a design doc all qualify — regardless of
   whether the request ever uses the words "script", "test", or "code". The test is the consumer,
   never the file type.

2. **The norm** — such a deliverable is not done when it is written. It is done only when it has
   been executed locally, in this session.

3. **The procedure**, at minimum:
   1. Verify every symbol, field, enumerated value, and relationship you reference against its authoritative definition — the current schema, type definition, or interface — never recall.
      Watch especially for implicit global filters that can make a lookup fail or silently match
      nothing.
   2. Establish the local state the artifact needs (see stack.md#commands for how this project
      brings up local state and runs a one-off script / ad-hoc code outside the test suite).
   3. Execute every phase the artifact contains, not only the happy path — including its
      preview/dry-run step. The rollback path must be executed too: it runs precisely when the
      operator is already in trouble, so an unexecuted rollback is an unverified rollback.
      Irreversible or value-bearing state raises the bar further.

4. **The disclosure** — the hand-off states that the artifact was executed locally, and names what local execution could not cover (a permission, a data shape, a scale, an integration only the
   live environment has).

5. **The escape hatch** — if local execution is genuinely impossible in this environment, say so
   explicitly rather than shipping silently; an artifact you could not execute is not done.

See stack.md#commands for this project's actual invocation of ad-hoc code and local-state setup.
