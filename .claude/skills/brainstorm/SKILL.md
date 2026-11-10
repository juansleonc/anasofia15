---
name: brainstorm
description: Generative/divergent ideation for when the WHAT or HOW of a feature is still open-ended — surfaces genuinely distinct approaches with trade-offs before you commit to one direction. Use before `/grill-me` and `/architect`, while the problem space is still fuzzy. Inspired by obra/superpowers' brainstorming skill.
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Bash, Write]
disable-model-invocation: false
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Brainstorm — Diverge before you converge

The agent helps you **generate options that don't exist yet**. Instead of refining a
single idea (that's `/grill-me`) or designing where code lives (that's `/architect`),
this skill **opens the solution space**: it decomposes a large vague request, generates
2-3+ genuinely different approaches across different axes, lays out the trade-offs, and
guides you to *choose a direction*. The chosen direction + the rejected alternatives
(with why) become the input for `/grill-me`.

The goal is **not a document** — it's a well-explored decision. The conversation itself
becomes the context for the convergent skills downstream.

## When to Use

- The **WHAT** is open: "we should do *something* about X" / "I want a better way to Y."
- The **HOW** is open: you know the goal but there are several plausible architectures.
- A request bundles **multiple independent subsystems** that need decomposing first.
- You catch yourself about to commit to the *first* solution that came to mind.
- As **Phase 0, before `/grill-me`** in an `/orchestrate` run, when the spec is not just
  fuzzy but *unformed*.

**Do NOT use for**: read-only questions, trivial one-line fixes, bug fixes with one
obvious cause, or any task where you already know what to build and only the edge cases
are fuzzy (→ go straight to `/grill-me`).

## Where it sits (don't duplicate the neighbors)

| Skill | Question it answers | Direction |
|-------|---------------------|-----------|
| **`/brainstorm`** | *What could we even build? Which of these approaches?* | **Divergent** — open options |
| `/grill-me` | *What exactly are we building, and what are the edge cases?* | Convergent — kill ambiguity |
| `/architect` | *Where does the code live and which patterns?* | Convergent — design the solution |
| `/opsx:explore` | *Let me think through this problem in OpenSpec.* | Exploratory, OpenSpec-coupled |

```
  idea unformed / multiple approaches plausible
        │
   /brainstorm   ← YOU ARE HERE (divergent)
        │  explore context → decompose → generate 2-3+ approaches
        │  → compare trade-offs → choose a direction
        ▼
   /grill-me     (convergent: ambiguity = 0 on the chosen direction)
        ▼
   /architect    (where code lives, which patterns)
        ▼
   /tdd          (RED → GREEN → REFACTOR)
```

Pick the entry point honestly: if you already know the approach, **skip to `/grill-me`** —
don't manufacture options to justify running this skill.

## Step 0: Check Investigations Folder (ALWAYS)

```bash
# Extract ticket ID from branch or message (e.g. CORE-715)
ls investigations/CORE-715/ 2>/dev/null
```

If prior research exists, **read it first**. Brainstorm from where the thinking already
stopped — don't re-generate options that an `understanding.md` already evaluated and
rejected.

## Workflow

### 1. Explore the context (silently, first)

Before generating anything, ground yourself: read the request, the relevant code, recent
commits, and `investigations/<TICKET>/`. You cannot generate *good* divergent options
without knowing the existing patterns, constraints, and what's already been tried.
Follow existing patterns; note real constraints (multi-tenancy, the 14 gateways, mobile
backward-compat, etc.) that will bound the option space.

### 2. Scope check — decompose before refining

If the request describes **multiple independent subsystems** ("a platform with chat,
billing, and analytics"), **flag it immediately**. Don't spend ideation budget refining a
project that needs to be split first. Help the user decompose:

- What are the independent pieces?
- How do they relate / depend on each other?
- What order should they be built?

Then brainstorm the **first** piece through the rest of this flow. Each piece gets its own
brainstorm → grill-me → architect → tdd cycle.

### 3. Understand purpose & constraints — one question at a time

Ask focused questions (prefer `AskUserQuestion` multiple-choice) to pin down **purpose,
constraints, and success criteria** — only enough to generate good options. One question
per message; don't overwhelm. This is *not* the full grill — you're gathering just enough
to diverge intelligently.

### 4. Diverge — generate genuinely distinct approaches

This is the heart of the skill. Generate **2-3+ approaches that are actually different**,
not one idea reworded three times. To force real divergence, run the idea through several
**lenses** and keep the ones that produce distinct architectures:

- **Simplest possible** — what's the smallest thing that could work? (YAGNI anchor)
- **Most ambitious** — if effort were free, what's the ideal?
- **Constraint-flip** — "what if we *couldn't* touch the DB / add a gateway / change the
  mobile API?" Forces a different shape.
- **Build vs. buy vs. reuse** — is there an existing pack/service/gem that already does
  most of this?
- **Invert the problem** — instead of "how do we add X," ask "what would make X
  unnecessary?"
- **Prior art** — how does a comparable system (or a sibling repo/service in your
  organization) solve this?

Discard near-duplicates. You want options that lead to *materially different* designs,
costs, and risks.

### 5. Compare trade-offs — lead with a recommendation

Present the surviving approaches conversationally with a trade-off table. **Lead with the
one you recommend and say why.** Be honest about cost, risk, reversibility, and how each
fits existing patterns. Example shape:

| Approach | Pro | Con | Cost / Risk | Fits existing patterns? |
|----------|-----|-----|-------------|-------------------------|
| A (recommended) | … | … | low | yes — extends existing module `x` |
| B | … | … | medium | new service |
| C | … | … | high | greenfield pack |

### 6. Converge — let the user choose the direction

Use `AskUserQuestion` to let the user pick (or combine) an approach. Be flexible: if the
discussion reveals a better option mid-stream, go back and add it. **YAGNI ruthlessly** —
strip features that aren't load-bearing from every option before presenting.

### 7. Capture the chosen direction (optional, local only)

If the brainstorm was substantial, offer to capture it so the next phase / a future
session can pick it up. Write to `investigations/<TICKET>/` (excluded via `.git/info/exclude` — **never** `docs/`, never code):

```bash
# investigations/<TICKET>/brainstorm.md  — chosen direction + rejected alternatives (with WHY)
```

The doc is a byproduct; the chosen direction stated in the conversation is the real output.

### 8. Hand off

Proceed to **`/grill-me`** to converge the chosen direction to ambiguity = 0, then
`/architect` → `/tdd`. The brainstorm transcript is already in context, so the chosen
direction and the discarded options never need re-explaining.

> **Terminal state is `/grill-me`** (or `/architect` if requirements are already crisp).
> Do NOT jump straight to implementation from here — diverging is not deciding the spec.

## Key Principles

- **Diverge before you converge** — generate real options *before* narrowing. Converging
  on the first idea is the failure this skill exists to prevent.
- **Genuinely distinct, not reworded** — 3 variations of one idea is 1 option. Use the
  lenses (§4) to force materially different shapes.
- **One question at a time** — multiple-choice preferred; don't overwhelm.
- **Lead with a recommendation** — options without a recommendation push the decision back
  onto the user without adding value.
- **YAGNI ruthlessly** — strip non-load-bearing features from every option.
- **Ground in reality** — options must respect real constraints (multi-tenancy, gateways,
  mobile compat). An "approach" that ignores them isn't an option.
- **Stay in your lane** — this skill opens the space and picks a direction. It does NOT
  resolve every edge case (that's `/grill-me`) or design code location (that's
  `/architect`).

## Anti-patterns

- ❌ Presenting "3 approaches" that are the same idea with cosmetic differences.
- ❌ Converging on the first solution because it came to mind first (anchoring).
- ❌ Generating options without reading the existing code/patterns first — uninformed
  divergence produces options that can't actually be built here.
- ❌ Refining details of a multi-subsystem request instead of decomposing it first.
- ❌ Writing a long PRD instead of facilitating a decision (the doc is a byproduct).
- ❌ Sliding into edge-case interrogation — that's `/grill-me`'s job; hand off.
- ❌ Jumping to code/scaffolding from here without converging through `/grill-me`.

## Integration with /orchestrate

`/brainstorm` is **coordinator-direct** (like `/grill-me`): it runs in the main thread
because it requires `AskUserQuestion`, which subagents cannot call. In an `/orchestrate`
run it is the optional **Phase 0 (pre-grill)** step, used only when the spec is *unformed*
(not merely fuzzy). Its output — the chosen direction — feeds Phase 0a `/grill-me`, whose
validation contracts then feed `/architect` and `/tdd`.

## Kaizen

> "Every day we must improve" — 改善

If you discover a divergence lens (§4) that repeatedly surfaces options the obvious ones
miss, append it to the lens list. Format: `<!-- Kaizen: YYYY-MM-DD --> ...`

History archived to `kaizen_log.md` (same directory).
