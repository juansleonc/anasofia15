---
name: architect
description: Strategic system-design and ADR authoring BEFORE any code is written — use before implementing a new feature, module/pack, service, schema change, or integration, and before major refactors. Ensures code lands in the right place, matches existing patterns, and is grounded against production data where an oracle exists. "Measure twice, cut once."
allowed-tools: [Read, Grep, Glob, Bash, Write, Edit, Agent]
disable-model-invocation: false
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Software Architect Skill

Strategic design decisions BEFORE any code is written — bridges requirements and implementation.
"Measure twice, cut once": bad architecture is expensive to fix.

**Run `/architect` before implementing:** new features, significant refactors, new integrations,
schema changes, new packages/modules. It ensures (1) code lives in the right place, (2) patterns
match the existing codebase, (3) scalability is considered upfront, (4) production data informs
design wherever a production oracle exists.

## OpenSpec Integration (Experimental)

**FIRST DECISION: Should this use the OpenSpec spec-driven workflow?** Heavy features defer to
`/opsx:new` (→ `/opsx:ff` → `/opsx:apply`) instead of continuing here. See `CLAUDE.md` →
"OpenSpec decision rule" (≥2 of: spans more than 1 day, customer-facing, multiple stakeholders,
compliance-sensitive, needs session handoff). If an OpenSpec change already has a `design.md`,
stop and use `/opsx:continue` / `/opsx:apply` rather than `/architect`.

## Architecture Decision Process

Ordered flow: **1. UNDERSTAND** the problem → **2. EXPLORE** how similar code works today →
**3. GROUND** against production data where an oracle exists → **4. RESEARCH** current
docs/best practices → **5. DESIGN** with trade-offs → **6. VALIDATE** domain invariants,
performance, security.

## Step 0: Check Investigations Folder (BEFORE ANYTHING ELSE)

**Always check for prior research before starting architecture work:**

```bash
# Replace <TICKET> with the actual ticket ID / slug from branch or message
ls investigations/<TICKET>/ 2>/dev/null || echo "No prior research found"
```

**If the folder exists**, read all files inside before proceeding — it may contain:
- Reference guides explaining domain behavior
- Prior findings about external API quirks
- Partially-completed design decisions
- Manual test scripts showing what was already validated

Starting architecture work without reading it risks duplicating hours of prior research.

---

## Step 1: Understand the Requirement

Before anything else, clarify:

| Question | Why |
|----------|-----|
| What is the user goal? | Avoid solving wrong problem |
| Who uses this? | Determines auth/UX surface |
| What data is involved? | Determines schema design |
| What's the expected volume? | Affects architecture choices |
| Are there similar features? | Reuse patterns |

## Step 2: Explore Existing Patterns

**Find similar implementations in the codebase** (adapt globs/dirs to this project's layout —
record the layout in stack.md if undocumented):

```bash
# Find related services/handlers for a keyword
grep -rn "class .*Service" <source_dir> | grep -i "<keyword>"

# Find related domain modules
ls <source_dir> | grep -i "<keyword>"
```

> (Ruby/Rails example) `grep -rn "class.*Service" app/services/ --include="*.rb"`; `ls packs/`;
> `grep -rn "class.*Mutation" app/graphql/mutations/ --include="*.rb"`.

> Use `Grep` and `Glob` for symbol-level discovery.

**Use Agent for deep exploration:**

```
Agent tool:
  subagent_type: "Explore"
  prompt: "Find all code related to <feature>. I need to understand:
    1. Where similar features live (models/entities, services, jobs)
    2. What patterns they use (service object, workflow/interactor, query object, ...)
    3. How they handle this project's domain invariants (data isolation, tenancy, etc.)
    4. API-layer types/handlers if applicable"
```

## Step 3: Ground Against Production Data (where an oracle exists)

**Consult the project's observability oracles** — `.claude/skills/shared/stack.md#observability`
— before designing volume- or usage-sensitive decisions: analytics warehouse, error tracker,
logs, whatever this project has wired up. If `stack.md#observability` is `N/A`/TODO, **declare
the design ungrounded-by-production-data explicitly** in the ADR rather than inferring volume or
usage patterns from code-reading alone.

**Questions to answer before designing, when an oracle exists:**

1. Does the related table/collection already exist, and what's its current volume?
2. What's the data distribution across the project's isolation key (tenant, org, account — per
   stack.md's domain invariants)?
3. What's the growth rate (new records/period) — does it change the scalability plan?
4. What's the cardinality/relationship shape (records per parent entity)?
5. What NULL/missing-data patterns affect schema design?

A worked query example (Ruby/Rails + ClickHouse) is in
[reference/examples.md](reference/examples.md).

**Volume thresholds for architecture decisions** (heuristic — calibrate to this project's actual
scale in stack.md if it differs):

| Records | Recommendation |
|---------|----------------|
| < 10k | Simple queries OK |
| 10k - 100k | Need indexes, consider pagination |
| 100k - 1M | Background jobs for bulk ops, caching |
| > 1M | Partitioning, read replicas, async processing |

## Step 4: Research Best Practices

**Consult `../shared/best-practices.md` first, when present** (created by `/stack-sync`) — it's
the project's durable, version-pinned view of its own stack, grounded in evidence instead of a
fresh lookup. Use its recorded practices as the baseline before falling back to Context7/web
search below. If the relevant technology's section stamp is >90 days old, or its recorded
version has drifted from the lockfile, note the staleness in the ADR and suggest a `/stack-sync`
refresh — this is informational, never a blocker for the design.

**Consult current docs for the project's frameworks/libraries** before designing — via a docs
tool if one is available (e.g. a Context7-style MCP server), or web search otherwise. This is
MANDATORY when the task introduces a dependency not yet used in the codebase: it catches naming
conventions, recommended patterns, and common pitfalls early, before they're baked into the ADR.

Useful query shapes, generalized by feature type:

| Feature Type | Query shape |
|--------------|-------------|
| CRUD operations | `"<framework> alternatives to scaffolding — service object patterns"` |
| Background jobs | `"<job framework> design patterns idempotency"` |
| API endpoints | `"<API framework> resolver/handler design, N+1 prevention"` |
| Notifications | `"<mailer/notification framework> async delivery patterns"` |
| File uploads | `"<framework> direct/streamed upload patterns"` |
| Search | `"<search engine> integration patterns for <framework>"` |
| Caching | `"<framework> caching strategies"` |

## Step 5: Design Proposal

### Start from the caller

Design outward from usage, never inward from storage. Before you name a table, pick a pattern, or
sketch an interface, write the calling code as you wish it already existed: the actual invocation,
what it is given, what it returns, and what the caller does next with the result. Keep it short —
it belongs in the ADR's Decision section, not in an appendix.

Everything below is then *derived from* that usage, in this order:

1. **The smallest honest data shape.** Honest: it can express every state the domain really has,
   including the awkward ones you would rather not model. Smallest: it holds nothing the usage
   above never reads.
2. **State transitions.** Which states exist, which moves between them are legal, who may make
   each move, and what must be true before and after it.
3. **Interfaces.** Exactly the boundary the caller touches. Anything the usage sketch does not
   reach stays private until a second caller argues otherwise.
4. **Module ownership.** One module owns each piece of state and each transition — name it. Two
   owners for one invariant is a bug you are choosing today and paying for later.

**Reject these on sight, before the design goes any further:**

- **Pass-through layers** — a module whose only job is to forward the call to the next one adds a
  name, a file, and one more place to drift out of sync, while removing nothing. Delete it and let
  the caller call.
- **Speculative extension points** — a hook, strategy slot, or config knob with exactly one
  implementation is a guess about a requirement nobody has stated. Build it when the second
  implementation actually arrives.
- **Duplicate representations of the same state** — the same fact recorded in two places will
  eventually disagree, and then neither is trustworthy. Pick the authoritative one and derive or
  drop the other.
- **Hidden temporal coupling** — two calls that must happen in a particular order, with nothing in
  the interface saying so. Make the wrong order impossible, or make the requirement explicit and
  checked; do not leave it in a comment.

### 5.0 Naming Conventions

Follow this project's existing naming conventions for the constructs you're introducing
(handlers/controllers, services, policies, background jobs, ...) — grep 3-5 existing examples of
each construct before inventing a new name. If undocumented, decide once and record it in
stack.md.

| Type | Pattern | Example (Ruby/Rails) | Anti-pattern |
|------|---------|-----------------------|-------------|
| Controllers | Adjective/noun form | `ApplicationController` | `AuthorizerController` |
| Services | Verb+noun | `CreateUserService` | `UserCreator` |
| Policies | `<Model>Policy` | `TestimonialPolicy` | `TestimonialAuth` |
| Concerns/mixins | Adjective/capability | `Authenticatable` | `Authenticator` |
| Jobs | Verb+noun+Job | `SyncContactJob` | `ContactSyncer` |

### 5.1 Code Location Decision

**Decision tree for where code lives:**

```
Is it a new domain with multiple entities/services?
  └── YES → New module/package for the domain
  └── NO → Continue...

Is it related to an existing module/package?
  └── YES → Add to that module
  └── NO → Continue...

Is it a cross-cutting concern?
  └── YES → shared services/concerns location
  └── NO → Continue...

Is it a single entity with simple logic?
  └── YES → colocate with the entity; extract a service if it grows complex
  └── NO → the project's services layer
```

**(Ruby/Rails example) package structure, if a new pack:**

```
packs/<feature_name>/
├── app/
│   ├── models/<feature_name>/
│   ├── services/<feature_name>/
│   ├── jobs/<feature_name>/
│   └── graphql/
│       ├── types/
│       └── mutations/
├── spec/
├── package.yml
└── README.md
```

### 5.2 Pattern Selection

| Pattern | When to Use | Example (Ruby/Rails) |
|---------|-------------|------------------------|
| Service Object | Simple single-purpose operations | `Users::ActivateService` |
| Workflow / Interactor | Complex multi-step workflows | `PaymentService::ProcessPayment` |
| Query Object | Complex database/data-source queries | `Users::SearchQuery` |
| Form / Command Object | Complex input validation | `Reservations::BookingForm` |
| Presenter / ViewModel | View-specific presentation logic | `MembershipPresenter` |
| Policy | Authorization rules | `ReservationPolicy` |

### 5.3 Data / Schema Design Discipline

**Mandatory fields, generalized (adapt to this project's ORM/migration tool):**

- The isolation/tenant key, if this project has one (per stack.md's domain invariants) — non-null,
  indexed, foreign-keyed.
- The business fields the feature actually needs — no speculative columns.
- Created/updated timestamps.
- A soft-delete marker, only if the domain requires undelete/audit.
- Composite indexes for the query patterns the design actually needs (e.g. isolation key + status,
  isolation key + created-at) — don't index speculatively.

**(Ruby/Rails example):**

```ruby
create_table :<table_name> do |t|
  t.references :facility, null: false, foreign_key: true, index: true # tenant key
  t.string :name
  t.timestamps
  t.datetime :deleted_at, index: true # only if soft-delete is needed
end
add_index :<table_name>, [:facility_id, :status]
```

### 5.4 API Layer Design

Design the project's actual API surface (REST/GraphQL/RPC — whichever this project uses):
consistent type/endpoint naming, pagination for lists, explicit input/output typing, and API
backward-compatibility for any external consumer (mobile app, partner integration, other
service).

**(Ruby/Rails + GraphQL example):**

```ruby
module Types
  class FeatureType < Types::BaseObject
    field :id, ID, null: false
    field :name, String, null: false
    field :items, Types::ItemType.connection_type, null: false # paginate lists
  end
end

module Mutations
  class CreateFeature < BaseMutation
    argument :input, Types::FeatureInputType, required: true
    field :feature, Types::FeatureType, null: true
    field :errors, [String], null: false
  end
end
```

### 5.5 Cross-module integration

When the design touches more than one module/package, decide the dependency **direction** here,
before implementation — not discovered later by a module-boundary linter (Ruby/Rails example:
Packwerk).

- State explicitly which module depends on which, and why.
- **Infra/shared modules never depend on domain modules** — infra is a client of domain, never
  the reverse.
- Choose the integration mechanism explicitly and record it in the ADR: a direct dependency
  declaration (domain → infra only), an event/notification bus (infra needs to react to a domain
  event), or a public API the domain module exposes. Note why alternatives were rejected.

### 5.6 Idempotency checklist (seeds / backfills / provisioning)

Any script or job that creates-or-finds records by a natural key must answer these before
implementation:

1. **Dedup key is immutable and system-owned.** Never dedupe on user-editable data (a `name`, a
   `title`) — a rename or a duplicate in source data breaks the match. Use a dedicated
   `system_key` (generated once, never displayed/edited).
2. **Walk the re-run matrix** — state the expected behavior per row, don't leave it implicit:
   resubscription/re-enrollment, cache loss (memoized lookup invalidated), archived rows (reuse vs
   skip vs re-create), user renamed the record (must not duplicate), partial prior run (crash
   mid-batch must be resumable without dupes).
3. **Name collisions in source data must not silently produce incomplete seeds** — a collision
   should fail loud (log + skip that record) rather than merge two distinct entities under one
   dedup key.

A migration, rollback, or backfill **command block** written directly into this design doc is a
hand-off executable — an artifact a human operator or a live environment will execute as-is. It
inherits the [Executable Handoff Gate](../shared/executable-handoff-gate.md) before being handed to
whoever will run it.

## Step 6: Validate Design

**Checklist before proceeding:**

| Check | How | Status |
|-------|-----|--------|
| Data isolation | All queries scoped by the project's isolation key (per stack.md domain invariants) | |
| Scalability | Grounded against real volume (Step 3), or explicitly declared ungrounded | |
| Pattern consistency | Matches existing codebase patterns | |
| Module boundaries | No circular dependencies | |
| API compatibility | No breaking changes to external consumers, if any | |
| Security | No data leakage across isolation boundaries | |
| Performance | Indexes planned, N+1 prevented | |
| Simplicity / YAGNI | Does the design build only what a contract requires? Any speculative params, abstractions, or gold-plating to cut? | |
| Acyclic references | Every reference the design adds ends at the thing that states the rule, per [P4](../shared/principles.md#p4--acyclic-references-that-resolve-to-something-that-ships) | |
| One canonical home | Each rule the design introduces has one home that everything else points to, per [P5](../shared/principles.md#p5--one-canonical-home-per-rule) | |

## Architecture Decision Record (ADR) Format

```markdown
## ADR: <Feature Name>

### Context
<What is the problem/requirement?>

### Grounding (production data)
- Table/collection: <name>
- Current volume: <X records> (or "ungrounded — no observability oracle per stack.md")
- Growth rate: <Y records/month>
- Key patterns: <NULL handling, cardinality>

### Decision
**Caller usage:** <the actual invocation: what it's given, what it returns, what the caller does next>
**Location:** <module/package or shared-services path>
**Pattern:** <Service Object, Workflow, etc.>
**Schema:** <New tables/collections, fields>
**States & transitions:** <states the shape can be in, which moves between them are legal, who may make each>
**API:** <endpoints/mutations/queries>

### Alternatives Considered
**Criteria:** <the 2-4 properties this choice is actually being made on, written down BEFORE scoring>
1. <Shape A — chosen> - Chosen because... <how it scores against each criterion>
2. <Shape B — structurally different from A, not a variant of it> - Rejected because...

### Consequences
- Good: <benefits>
- Bad: <trade-offs>

### Side Effects & Transaction Boundaries
- Writes: <what gets written, and when it becomes visible to others>
- Atomicity: <what is atomic with what>
- Retry safety: <what is safe to retry, and what is not>

### Implementation Plan
1. <Step 1>
2. <Step 2>
3. <Step 3>

### Verification Plan
- <the checks, tests, or measurements that would catch this design being wrong>

### Fragility Notes
- Most fragile assumption: <the single assumption most likely to break>
- When it breaks: <trigger/condition>
- Consequence: <what happens>
- Mitigation or accepted risk: <mitigation, or explicit accepted-risk statement>
```

**Alternatives Considered is not a formality.** For any decision that is consequential or hard to
reverse, compare at least two *structurally different* shapes: different ownership, different data
model, different failure mode. Two spellings of the same design are one alternative, and
"considered B, chose A" written after A was already built is theatre. State the criteria before you
score, so the comparison can come out against your first instinct.

**Never average the candidates.** When two shapes both look defensible, the tempting move is to
take some of each. Resist it: the merged design is bigger than either candidate and inherits both
sets of invariants — every rule A needed and every rule B needed now hold simultaneously, in one
place, forever, and nobody downstream can name why either exists. That is how a system acquires
constraints no one chose. Pick one shape, record what you give up by not picking the other, and
let the rejected option stay rejected. If neither is acceptable as-is, that is evidence a third
shape exists — go find it rather than gluing the first two together.

**Fragility Notes is mandatory** — name ONE assumption, not a hedge list. Complements (does not
replace) the Consequences/Alternatives risk discussion above; this is the single sharpest one.

For non-trivial work, emit `investigations/<TICKET>/tasks.md`: promote the Implementation Plan
above into an ordered checklist where **1 task = 1 testable behavior = 1 RED→GREEN cycle**, each
naming its file + test and the contract(s) C1..Cn it satisfies (per
`investigations/_RPI-TEMPLATE.md`). `/tdd` walks it one task at a time; the `investigation` skill's
CHECK verifies presence and shape before Implement starts. Trivial single-behavior work skips
`tasks.md` — the one TDD cycle IS the micro-task.

<!-- Kaizen: 2026-06-09 - Placeholder anti-pattern catalog (adapted from obra/superpowers, MIT) -->
## Plan Self-Check: Placeholder Anti-Patterns

Before handing off a design proposal or ADR, grep your own plan for these signals. If found, the
plan is not ready to implement:

- **"TBD" / "TODO" / "implement later"** — a plan with a hole is not a plan; fill it or cut the
  step.
- **"Add appropriate error handling" / "handle edge cases"** — name the specific cases (nil owner,
  missing parent record, duplicate call) and show the handling; vague directives generate vague
  code.
- **"Similar to Task N" / "same as above"** — repeat the concrete steps inline; the implementer
  cannot act on a pointer to another step.
- **Steps that say WHAT without showing HOW** — each step must name the file, the method/change,
  and how it is verified (test name or assertion); a step missing any of the three is incomplete.
- **Speculative surface** — an unrequested optional param, config knob, or abstraction "for later"
  is a YAGNI violation; cut it or move it to a followup. Enforced downstream by the project's
  code-simplification pass (matching project skill if present, else manual).

---

## Handoff

`/architect` hands over a design, not an implementation. Whoever picks it up next — `/tdd`, an
implementer, a reviewer — should be able to start without asking you a question. What you hand
over is the ADR, and it must settle all of this. Each requirement is taught once, in Step 5
("Start from the caller") and 5.5 — the table below is an index into the ADR field that must hold
it, not a second description of it:

| Element | ADR field that holds it |
|---------|--------------------------|
| Caller usage | `### Decision` → **Caller usage:** |
| Data & state model | `### Decision` → **Schema:** and **States & transitions:** |
| Interfaces | `### Decision` → **API:** |
| Ownership map | `### Decision` → **Location:** |
| Side effects & transaction boundaries | `### Side Effects & Transaction Boundaries` |
| Alternatives considered | `### Alternatives Considered` |
| Chosen trade-off | `### Consequences` → **Bad:** |
| Verification plan | `### Verification Plan` |

Report the outcome using the shared status vocabulary rather than prose of your own invention:
[Return Status](../shared/return-status.md). A design that reached a shape but left a constraint
unsettled is `DONE_WITH_CONCERNS`, not `DONE`; a requirement you cannot resolve alone is
`NEEDS_CONTEXT` — guessing at it is precisely the failure this skill exists to prevent; and a
design no answer from the caller could unblock, because the constraint sits outside the decision
you were asked to make, is `BLOCKED`.

### Re-grounding: implementation is evidence about the design

A design is a hypothesis about the shape of the problem, and implementation is the first
experiment that can falsify it. When implementation is in scope — you are carrying the design
through yourself, or reviewing work that followed it — repeated deviations are design evidence,
not noise to absorb.

**Signals, each counted when it recurs rather than the first time it appears:**

- A new parameter threaded through call after call so a callee can reach information it should
  already have had.
- A cast, coercion, or unwrap that exists only to make two representations of the same thing line
  up.
- A compatibility shim bridging a new path to the old one it was supposed to replace.
- A lock, guard, or retry added to enforce an ordering the interface never made explicit.
- The same special case reappearing at every layer, spelled slightly differently each time.

When the same signal turns up a third time, stop before adding the fourth workaround. Go back to
the caller usage and the ownership map, name the constraint you now know about and did not when
you sketched, and reshape the design around it — then amend the ADR, because a Consequences
section that never learned what implementation taught is a document the next reader will trust and
be misled by. Every workaround stacked on a design that is fighting the problem makes that design
more expensive to replace.

**Counter-guard: one ordinary edge case does not condemn an architecture.** Real domains have
irregular corners, and a single special case handled honestly in one place is far cheaper than a
redesign. The trigger is *recurrence* — the same shape of workaround, in more than one place, for
more than one reason. One is a corner; three is a message.

---

## Examples & Integrations

- Worked ADR example (Push Notifications feature, Ruby/Rails): see
  [reference/examples.md](reference/examples.md).
- Architecture diagrams: check whether a diagramming tool is available in this environment (e.g.
  an `mcp__mermaid__*` server); if not, use text-based diagrams in ADRs.

---

## Kaizen

Continuous-improvement history lives in [kaizen_log.md](kaizen_log.md) (sibling-skill
convention). When you discover a new pattern, missing criterion, or better grounding query:
finish the current review first, then append an entry there (`<!-- Kaizen: YYYY-MM-DD --> …`). Do
NOT inline Kaizen entries back into this file.
