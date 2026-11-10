---
name: grill-me
description: Before building a feature/refactor, the agent interviews YOU until every branch of the decision tree is resolved (ambiguity = 0). The interview transcript becomes the implementation context. Use when requirements are fuzzy, before /architect and /tdd.
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Bash]
disable-model-invocation: false
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Grill Me — Interrogate the human until ambiguity is zero

The agent interviews **you** about a feature/design until every branch of the
decision tree is resolved. The goal is **not a document** — it's a genuine shared
mental model (Brooks' "conceptual integrity") before any code or schema is touched.
The conversation history itself becomes the implementation context for `/architect`
and `/tdd`, so nothing needs to be re-explained downstream.

## When to Use

- Before implementing a feature or non-trivial refactor whose requirements are fuzzy.
- When a Jira ticket leaves edge cases, ownership, or scope under-specified.
- As **Phase 0, before `/architect`** in an `/orchestrate` run.
- Whenever you catch yourself about to make 3+ silent assumptions to start coding.

> **Predecessor**: if the idea itself is still unformed (the *what* or *how* is open, multiple approaches plausible), run `/brainstorm` first to diverge and pick a direction — then invoke `/grill-me` to converge on details. `/brainstorm` → `/grill-me` → `/architect`.

**Do NOT use for**: read-only questions, trivial one-line fixes, or tasks where the
spec is already unambiguous.

## Why this exists (and how it differs from /architect)

| Skill | Question it answers |
|-------|---------------------|
| `/grill-me` | *What exactly are we building, and what are the edge cases?* (removes ambiguity from the **requirement**) |
| `/architect` | *Where does the code live and which patterns do we use?* (designs the **solution**) |

`/grill-me` runs first. Its output feeds `/architect`. This is the sharper,
proactive form of interviewing the code — enumerate every write path the change
touches before trusting any assumption about it — applied to the human *before*
writing, not just to the code after.

## Step 0: Check Investigations Folder (ALWAYS)

```bash
# Extract ticket ID from branch or message (e.g. CORE-624)
ls investigations/CORE-624/ 2>/dev/null
```

If prior research exists, **read it first** — don't ask questions already answered
there. Cite what you already know so the human only fills genuine gaps.

## Workflow

### 1. Build the decision tree (silently, first)

Read the ticket / request and the relevant code. Enumerate every dimension that
could change the implementation. Cover at least:

- **Scope boundary**: what is explicitly in vs. out? (Re-read the ticket's
  "Out of scope" — see memory `[[feedback_respect_approved_scope]]`.)
- **Data model**: new tables/columns? migrations? data-isolation/tenancy scoping (if the domain has it)?
- **Write paths**: every code path that mutates the affected data — interview the
  code, don't assume there's only one.
- **Edge cases**: nil/empty, duplicates, concurrency, wrong-record selection, partial failure.
- **Money/idempotency**: if payments/memberships touched — transactions, retries, who pays.
- **API surface**: GraphQL/REST changes? will existing clients still work (API
  backward compatibility)?
- **Auth**: who can do this? authorization parity across every surface the action
  is reachable from (UI/API/jobs/channels) — a check added to one path and missed
  on another is a live vulnerability, not a style nit.
- **Failure/observability**: what happens when the external call fails? what gets logged?
- **Done definition**: what proves it works? which tests, which manual QA?

### 2. Interrogate — in batches, until resolved

Ask focused questions, batched by theme, using `AskUserQuestion` (offer concrete
options when you can — never make the human author free text you could propose).

Rules of the grill:
- **Do not proceed while any branch is unresolved.** Keep going until you can
  predict the human's answer to every remaining question.
- One theme at a time; don't dump 40 questions at once. Iterate.
- When an answer opens a new branch, add it to the tree and keep grilling.
- Surface assumptions explicitly: "I'm assuming X — confirm or correct."
- **Depth calibration**: For non-trivial features, expect 40–100 exchanges across multiple
  rounds — not as a quota to fill, but as a signal that no branch is unresolved. Stop when
  every assumption, edge case, and out-of-scope item has a confirmed answer. For a small bug
  fix or isolated change, 10 exchanges is fine. Depth here is cheaper than rework later.

### 3. Product-decision ledger (CONFIRMED vs ASSUMED)

For every decision that crosses features or is product-owned — archive vs delete
semantics, cross-feature visibility, which field maps to a business concept, any
UX/copy — log it as one of:

- **CONFIRMED** (by whom — e.g. "confirmed with Rafa"): product explicitly signed off.
- **ASSUMED**: no explicit sign-off; you inferred it or proceeded without confirmation.

Any UI/UX contract MUST reference the ticket's Figma link, and copy strings quoted
in the contract must match Figma verbatim — don't invent modal copy or extra screens
the design doesn't show.

Writing an item down does not resolve it: ASSUMED items must be carried into the PR
body under "Pending product confirmation" (see `/create-pr`) so the reviewer sees
them declared instead of discovering them in review.

(Origin: PR #5290/#5319 review threads were dominated by "esperemos confirmación de
Rafa" and Figma-copy mismatches that should have been resolved or declared up front —
see `investigations/pr-review-process-audit/findings.md`.)

### 4. Reflect the resolved model back

Once ambiguity is zero, restate the shared understanding compactly:
- One-paragraph statement of what's being built.
- Bullet list of resolved decisions (the answers).
- The product-decision ledger from step 3 (CONFIRMED/ASSUMED, who/when).
- Explicit **in-scope / out-of-scope** lines.
- Open risks the human accepted.

Ask: "Is this the shared model? Anything I got wrong?" Wait for confirmation.

### 4.5 Adversarial Gate (mandatory, before handoff)

Ask one closing question: **"What important failure scenario is not covered by any contract above?"**
Always record the answer — never skip this. Then either add the missing contract to the resolved
model, or explicitly mark it out-of-scope (carry it to the PR body per step 3's ledger).

### 5. Persist only the brief (optional, local)

The *conversation* is the primary context — don't re-summarize for the agent.
If the work spans sessions, save just the resolved brief to:

```
investigations/CORE-624/grill-me-brief.md
```

(Local only — `investigations/` is in `.git/info/exclude`. Never `docs/`.)

### 6. Hand off

Proceed to `/architect` (design) → `/tdd` (red-green-refactor). The grill transcript
is already in context, so neither needs the requirement re-explained.

## Anti-patterns

- ❌ Asking one vague "any other requirements?" and calling it grilled.
- ❌ Writing a long PRD instead of building shared understanding (the doc is a
  byproduct, not the goal).
- ❌ Starting to code with unresolved branches "to keep momentum" — that's exactly
  the rework this skill prevents.
- ❌ Re-asking what `investigations/CORE-XXX/` already answers.

## Kaizen

> "Every day we must improve" — 改善

If you discover a recurring class of question worth always asking (e.g. a domain
keeps needing a specific edge case probed), append it to the Step 1 checklist.
Format: `<!-- Kaizen: YYYY-MM-DD --> ...`

See archived entries in [kaizen_log.md](kaizen_log.md).
