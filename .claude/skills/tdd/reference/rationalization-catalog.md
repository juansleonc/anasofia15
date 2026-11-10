# Common Rationalizations — Intercept Before Skipping the Test

Detail for the "Common Rationalizations" pointer in [../SKILL.md](../SKILL.md). Relocated verbatim
(progressive disclosure) — no content changed from the original inline section.

Thinking about skipping the RED step? Match your thought against this table first.

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is technical debt. |
| "Keep as reference, write tests first" | You'll adapt it. That's testing after. Delete means delete. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "Test hard = design unclear" | Listen to test. Hard to test = hard to use. |
| "TDD will slow me down" | TDD faster than debugging. Pragmatic = test-first. |
| "Manual test faster" | Manual doesn't prove edge cases. You'll re-test every change. |
| "Existing code has no tests" | You're improving it. Add tests for existing code. |
| "It's frontend/JS — there's no unit-test framework" | **Not exempt.** A frontend behavioral change still needs RED. Escalate to a system/E2E test as the RED (see [stack.md#test-conventions](../../shared/stack.md) for this project's system-test setup), or write the failing test at the **nearest testable boundary** (the serializer / data contract the change depends on). "No unit harness" ≠ license to skip RED. |

**Red Flags — STOP and Start Over:**
- Code before test
- Test after implementation
- Test passes immediately without seeing it fail
- Can't explain why test failed
- Tests added "later"
- Rationalizing "just this once"
- "I already manually tested it"
- "Keep as reference" or "adapt existing code"
- "Already spent X hours, deleting is wasteful"
- "TDD is dogmatic, I'm being pragmatic"
- "This is different because..."

**All of these mean: Delete code. Start over with TDD.**
