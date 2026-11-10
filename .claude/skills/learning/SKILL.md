---
name: learning
description: Turns a user correction into a durable lesson recorded in auto-memory and propagated to the skills it affects. Use whenever the user corrects, redirects, or signals dissatisfaction with prior assistant output — confirms with the user before persisting (hybrid trigger: detection + confirmation).
allowed-tools: [Read, Edit, Write, Bash, Grep, Glob]
disable-model-invocation: false
---

> **📋 Config Priority**: see `../shared/config-priority.md#config-priority` — cite it, do not restate it.

# Learning Skill - Capture Corrections, Never Repeat

> "El que no aprende de sus errores, está condenado a repetirlos."

## Purpose

Capture user corrections in real time, extract the underlying lesson, and persist it across two surfaces:

1. **Auto-memory** — `memory/feedback_*.md` (project-relative, seeded once by `install.sh`, never clobbered) survives across conversations.
2. **Skill kaizen sections** — `.claude/skills/<name>/SKILL.md` changes behavior in future skill runs.

Corrections are the highest-signal training data available. Every correction missed is a future repeat.

## Philosophy

> "If you only correct me once and I repeat the mistake, the system is broken — not you."

1. **Trust signals over politeness** — when the user says "no", "stop", "mejor X", "incorrect", treat it as a correction event, not conversational noise.
2. **Storage on both axes** — memory persists across sessions; skill kaizen entries change behavior in workflows. Both matter.
3. **Confirmation prevents noise** — detection is automatic, but persistence requires explicit `y/n`. False positives must not pollute memory.

---

## When to Use

### Hybrid Trigger (Detection + Confirmation)

**Auto-suggest when the user message after substantial assistant output contains correction signals**:

| Category | Spanish | English |
|----------|---------|---------|
| Negation | `no`, `mal`, `incorrecto` | `no`, `wrong`, `incorrect`, `don't` |
| Halt | `stop`, `para`, `detente`, `espera` | `stop`, `wait`, `halt` |
| Better way | `mejor X`, `usa X`, `debería ser X` | `should be X`, `use X instead` |
| Forbidden | `no hagas`, `prohibido`, `nunca` | `never`, `don't ever`, `forbidden` |
| Style preference | `prefiero X`, `mantén X` | `I prefer X`, `keep X` |
| Surprise | `por qué hiciste`, `quién te dijo` | `why did you`, `who told you` |
| Direct | `te equivocaste`, `ese no es` | `you're wrong`, `that's not` |

### Detection Algorithm

```ruby
def correction_detected?(user_message, prior_assistant_message)
  return false if user_message.nil? || prior_assistant_message.nil?
  return false if prior_assistant_message.length < 100  # ignore tiny outputs
  return false if responding_to_my_question?(prior_assistant_message)

  signals = CORRECTION_KEYWORDS.any? { |kw| user_message.downcase.include?(kw) }
  imperative = user_message.match?(/^(no|stop|para|wait|don't|never)\b/i)
  references_prior = user_message.length < 200 && substantive(prior_assistant_message)

  signals || imperative || references_prior
end
```

### Skip if

- Prior assistant message was a question via `AskUserQuestion` (user is answering, not correcting)
- Message is a confirmation: `gracias`, `ok`, `bien`, `thanks`
- User is requesting a new task, not redirecting prior output
- Detection sensitivity downgraded after 3 consecutive `n` rejections in this session

### Manual Invocation

```bash
/learning                       # Capture last correction in this session
/learning "<lesson text>"       # Save explicit lesson with no detection
/learning review                # Show recent feedback memories
/learning propagate <skill>     # Push existing memory into a specific skill
/learning conflict <slug>       # Check if a new memory contradicts existing
```

---

## Workflow

### Phase 1: Detect

Scan user message for correction signals against the prior assistant message. If matched, proceed to extraction.

### Phase 2: Extract Lesson

From the correction, derive 4 fields:

| Field | How |
|-------|-----|
| **Rule** | Imperative: "Always X", "Never Y", "Prefer X over Y" |
| **Why** | Reason user gave (or inferred from context) |
| **How to apply** | When/where this rule kicks in (file types, workflows, scenarios) |
| **Affected skills** | Map keywords → skills (see Skill Mapping below) |

**Example**:

```
User said: "no, nunca pongas tickets en comentarios de código"
Prior: assistant wrote `# CORE-189: validate contact` in a ruby file

Extracted:
  Rule:    Never reference ticket IDs in inline code comments
  Why:     Comments must explain invariants, not work history
  Apply:   When writing comments in any code file (.rb, .js, .ts, .py)
  Skills:  code-review, tdd, coverage
```

### Phase 3: Confirm

Show extraction to user, wait for response:

```
🎓 Aprendizaje propuesto:

  Rule:   Never reference ticket IDs in inline code comments
  Why:    Comments must explain invariants, not work history
  Apply:  When writing comments in any code file
  Skills: code-review, tdd, coverage

Acciones:
  y    → guardar en memoria + propagar a skills afectadas
  n    → cancelar (falso positivo)
  edit → modificar antes de guardar
  m    → solo memoria, no propagar a skills
```

### Phase 4: Persist

#### 4a. Auto-memory (always on `y` or `m`)

Write `memory/feedback_<slug>.md` (project-relative — the project's own `memory/` directory, seeded
once by `install.sh`) using the frontmatter shape defined in
[`../shared/memory-conventions.md#file-format`](../shared/memory-conventions.md#file-format) — that
document is the single source of truth for the schema, not restated here.

**Slug rules**:
- `feedback_<topic>.md`, lowercase, snake_case, ≤ 5 words
- Check existing memories first via `ls memory/feedback_*.md`
- If similar exists, prefer **update** over create (use Edit, append `**Update <date>:**` line)

If the project maintains a `memory/MEMORY.md` index, add or refresh a one-line pointer entry for the
new file there (create the file if the project doesn't have one yet but wants to start one) — see the
MEMORY.md index-entry template in the [Templates](#templates) section. This is optional bookkeeping,
not a required gate.

#### 4b. Skill kaizen propagation (only on `y`) — MANDATORY, VERIFIED, not optional

For each skill in the `Affected skills` list, append the skill-kaizen entry (template in the [Templates](#templates) section) to its `SKILL.md`. Place it at the end of the skill's "Recent Improvements" / "Kaizen" section. If no such section exists, create one at the end of the file.

**Point, don't copy.** The memory file written in 4a is the lesson's one canonical home — its Why and full statement live there and nowhere else. Each skill's entry carries only a short Rule headline, a "How to apply here" line written for *that* skill, and a Source pointer to the memory file. Never paste the same Why or long rule text into every affected `SKILL.md`: identical copies drift the moment one is edited, and a reader can no longer tell which copy is the rule. (In dojo's own tree, `/qa-audit`'s `[duplicate-blocks]` check enforces this for the files dojo ships; an installed project's audit skips it, so the discipline here is what keeps a project's skills from drifting.)

Propagation is not a nice-to-have alongside the memory write — a memory persisted without propagation is an **incomplete learning** and must not be reported as done. After appending, **verify each edit landed**:

```bash
grep -n "Kaizen: <today>" .claude/skills/<skill>/SKILL.md   # for every skill in the list
```

If any listed skill was not actually edited, do not close Phase 4 — go back and edit it. The Phase 5 confirmation to the user MUST list the exact skill file paths edited (e.g. `.claude/skills/tdd/SKILL.md`), not just skill names — a name alone is not verifiable evidence of propagation.

**Evidence this loop breaks silently if skipped** (origin-platform case): two feedback memories were persisted but never propagated to the affected review/tdd skills; the exact same review comment (process artifacts — contract IDs, ticket refs — leaked into committed code) recurred in two later PR review threads. Propagation without verification is how lessons die.

#### 4c. Memory health check (always, after 4a/4b, before Phase 5)

After persisting, run `bash .claude/skills/learning/scripts/memory_check.sh --report memory/`. If it
exits non-zero (a `TRIGGERED:` line present), treat the findings as **blocking**: do not close Phase 4
or proceed to Phase 5 until resolved, following the prune recipe at
`../shared/memory-conventions.md#prune-recipe`. INFO-only output (exit 0) is non-blocking — proceed.

**Checklist before closing Phase 4**:
- [ ] `memory/feedback_<slug>.md` (or `reference_*`/`project_*`) written (4a)
- [ ] `updated: YYYY-MM-DD` frontmatter key written/refreshed in the topic file (today's date;
      match `updated: "2026-06-14"` quoted-string format)
- [ ] `memory/MEMORY.md` one-line pointer entry added/refreshed, if the project maintains that index (4a)
- [ ] Skill kaizen propagation done AND verified via grep if `y` (4b) — file paths ready to list in Phase 5
- [ ] `memory_check.sh --report memory/` run; any TRIGGERED finding resolved per
      `memory-conventions.md#prune-recipe` (4c)

### Phase 5: Confirm to User

```
✅ Guardado:
  📝 memory/feedback_<slug>.md (nuevo)
  🔄 memory/MEMORY.md actualizado (entrada nueva, si el proyecto mantiene ese índice)
  🧠 Propagado y verificado en:
     - .claude/skills/adversarial-review/SKILL.md
     - .claude/skills/tdd/SKILL.md
     - .claude/skills/coverage/SKILL.md

Próximas conversaciones aplicarán esta regla automáticamente.
```

---

## Skill Mapping (Correction Topic → Skills)

Use this map to decide which skills receive kaizen entries. Rows also update `stack.md` when the correction is a stack convention (a command, a tool, a format). Domain-specific topics route to the matching project skill if one exists (CLAUDE.md router / `stack.md#analysts`). When unclear, default to `adversarial-review` only.

| Correction topic | Affected skills / docs |
|------------------|-----------------|
| Comments / docs style | `adversarial-review`, `tdd`, `coverage`, `architect` |
| Naming conventions | `adversarial-review`, `architect`, `tdd` |
| Test patterns | `tdd`, `coverage`, `stack.md#test-conventions` |
| Lint workflow | `commit`, `create-pr`, `stack.md#commands` |
| Git / branch / commit | `commit`, `create-pr`, `stack.md#vcs` |
| Module / package boundaries | `architect`, `thermo-review` |
| Data isolation / scoping | `adversarial-review`, the project's domain skill if present |
| Time / timezone | `tdd`, `adversarial-review`, `stack.md#test-conventions` |
| Performance / queries | `codebase-audit`, `stack.md#audit-checks` |
| Migration safety | `adversarial-review`, `tdd` |
| Auth / permissions | `adversarial-review`, the project's domain skill if present |
| Investigation workflow | `investigation`, `architect`, `orchestrate` |
| Commands / exec wrapper | `stack.md#commands`, `commit` |
| Structural quality | `thermo-review`, `optimize-skill` |
| **Cross-cutting / unclear** | `adversarial-review` only (default) |

---

## Conflict Resolution

If a new correction contradicts an existing memory:

```
⚠️ Conflicto detectado:

Existing: feedback_xxx.md says "<old rule>"
New:      "<new rule>"

Acciones:
  r → reemplazar (new fully supersedes old → note it in the memory file and mark the old one superseded)
  k → conservar ambos sin resolución (contradición genuina → keep both, flag it in `memory/MEMORY.md` if maintained)
  m → fusionar (combine into one entry, mark old as superseded)
  c → cancelar
```

Default: ask user. Never auto-resolve.

---

## False Positive Handling

If user says `n` (don't save) **3 times in a row this session**:
- Stop auto-suggesting in this session
- Wait for explicit `/learning` invocation
- Note for kaizen review: detection threshold may need tuning

This prevents the skill from becoming annoying.

---

## Templates

> **Learning-specific only.** The two templates below (skill kaizen entry, MEMORY.md index line) are
> unique to this skill's Phase 4 and have no other home. The memory-file frontmatter schema itself is
> NOT restated here — [`../shared/memory-conventions.md#file-format`](../shared/memory-conventions.md#file-format)
> is the single canonical source; Phase 4a links there directly.

### memory/MEMORY.md index entry (optional — only if the project maintains this file)

Append a one-line pointer entry, newest last (or create `memory/MEMORY.md` if the project wants to start one):

```markdown
- [[feedback_<slug>]] — updated: <YYYY-MM-DD> — <one-line hook ~150 chars>
```

### Skill kaizen entry

Append at end of target skill:

```markdown
<!-- Kaizen: YYYY-MM-DD - User correction -->
- Rule: <the rule as a short headline, well under 25 words>
- How to apply here: <what the rule changes in THIS skill's steps — differs per skill>
- Source: `memory/feedback_<slug>.md` (the Why lives there)
```

No `Why:` line: the reason is in the memory file, and repeating it in every affected skill is the
duplication Phase 4b forbids.

---

## Examples

Three worked end-to-end examples (style correction, workflow correction, new-memory naming correction) live in [`examples.md`](examples.md).

---

## Integration with `/kaizen`

The `/kaizen` skill periodically audits all skills for outdated patterns. Entries written by `/learning` use the standard `<!-- Kaizen: YYYY-MM-DD - User correction -->` marker so kaizen audits can:
- Detect duplicate corrections across skills
- Identify high-frequency correction topics (signal for systemic issue)
- Verify that skill behavior actually changed (not just docs updated)

When `/kaizen` runs, it should report stats on corrections captured by `/learning` since last audit.

---

## Recent Improvements (Kaizen)

> Full history archived in [`kaizen_log.md`](kaizen_log.md). Add new entries there; promote to the active body only if they change operational behavior.
