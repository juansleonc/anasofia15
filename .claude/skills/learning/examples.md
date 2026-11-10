# Learning Skill — Worked Examples

Three end-to-end examples of detection → extraction → confirmation → persistence. Referenced from [`SKILL.md`](SKILL.md) → "Examples".

---

## Example 1: Style correction

```
Assistant wrote a 6-line rdoc comment block above a Ruby method.

User: "no, comentarios cortos máximo 1 línea, los detalles van en /docs"

Detected → Extract:
  Rule:   Inline comments max 1-3 lines; detailed docs go in /docs folder
  Why:    Code stays lean; rationale belongs in commit/PR/docs
  Apply:  When writing rdoc, comment blocks, or method documentation
  Skills: code-review, tdd, architect

User confirms: y

Saved:
  📝 memory/feedback_lean_comments.md (already exists → updated with new example)
  🔄 memory/MEMORY.md (entry already present, no change, if the project maintains that index)
  🧠 Propagado a: code-review, tdd, architect (kaizen entries added)
```

## Example 2: Workflow correction

```
Assistant ran `git commit` without running the project linter first.

User: "stop, always lint before commit"

Detected → Extract:
  Rule:   Always run the project linter before git commit, even for cherry-picks/squashes
  Why:    PR feedback flagged lint issues that the linter would have caught
  Apply:  Before any `git commit` invocation
  Skills: commit, create-pr, code-review

User confirms: y

Saved:
  📝 memory/feedback_lint_before_commit.md (already exists → reinforced)
  🔄 memory/MEMORY.md (entry already present, no change, if the project maintains that index)
  🧠 Propagado a: commit, create-pr, code-review
```

## Example 3: Naming correction (new memory)

```
Assistant named a controller `ReservationCancelerController`.

User: "no, en Rails los controllers son adjetivos: AuthorizedController no AuthorizerController"

Detected → Extract:
  Rule:   Rails controllers use adjective form (Authorized, not Authorizer)
  Why:    Rails convention; no verbs as class names — classes are categories
  Apply:  When naming any controller class
  Skills: code-review, architect

User confirms: y

Saved:
  📝 memory/feedback_controller_naming.md (NEW)
  🔄 memory/MEMORY.md (if maintained): `- [[feedback_controller_naming]] — updated: <DATE> — Rails controllers use adjective form (Authorized not Authorizer); no verb class names`
  🧠 Propagado a: code-review, architect
```
