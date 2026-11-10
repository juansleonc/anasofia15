# Assertion Quality — Worked Examples

> Examples below are Ruby/RSpec (origin platform); the assertion-quality principles are stack-agnostic.
<!-- residue-ok: file -->

Detail for the "Assertion Quality Catalog" table in [../SKILL.md](../SKILL.md). These are patterns an
LLM (or a rushed human) generates that pass in green without proving the behavior — the "coverage
theater" failure mode taken one level further: the assertion itself is worthless, not just weak.

**Contents**: [1. Tautology](#1-tautology) · [2. Ghost loop](#2-ghost-loop) · [3. Orphan empty-collection assertion](#3-orphan-empty-collection-assertion) · [4. Implementation-detail coupling](#4-implementation-detail-coupling) · [5. Empty smoke test](#5-empty-smoke-test) · [6. Asserted name, unasserted value](#6-asserted-name-unasserted-value) · [7. Defeasible negative assertion](#7-defeasible-negative-assertion) · [Mock/assertion ratio](#mockassertion-ratio--worked-example) · [Source](#source)

## 1. Tautology

```ruby
# BAD — asserts on the fixture, not the unit under test
membership = build(:membership, status: 'active')
expect(membership.status).to eq('active')  # you just set this yourself

# GOOD — asserts the OUTPUT of behavior
membership = build(:membership, status: 'pending')
membership.activate!
expect(membership.status).to eq('active')
```

## 2. Ghost loop

The single most dangerous pattern here — it looks like real verification but silently no-ops when the
collection is empty.

```ruby
# BAD — if find_active_memberships returns [], this test is GREEN and proves nothing
memberships = facility.find_active_memberships
memberships.each do |m|
  expect(m.status).to eq('active')
end

# GOOD — assert non-emptiness (or exact count) BEFORE the loop
memberships = facility.find_active_memberships
expect(memberships).not_to be_empty
memberships.each do |m|
  expect(m.status).to eq('active')
end

# BETTER — assert the exact set when the count is knowable
expect(memberships.map(&:id)).to contain_exactly(active_a.id, active_b.id)
```

Ghost loops are especially dangerous paired with a query bug: if a `facility_id` scope is dropped and
the query returns `[]` instead of the expected records, a ghost-loop test still passes — the exact bug
class this catalog exists to catch.

## 3. Orphan empty-collection assertion

```ruby
# BAD — the ONLY assertion is that nothing came back; never proves the populated path works
result = MembershipSearchService.call(facility: facility, query: 'no-match-anywhere')
expect(result).to eq([])

# GOOD — cover the populated case as the primary assertion; empty-result is a SEPARATE, deliberate edge case
result = MembershipSearchService.call(facility: facility, query: matching_membership.plan_name)
expect(result).to contain_exactly(matching_membership)

# empty case as its own explicit example, not the only one:
it 'returns empty when no plan matches' do
  expect(MembershipSearchService.call(facility: facility, query: 'zzz-no-match')).to eq([])
end
```

## 4. Implementation-detail coupling

```ruby
# BAD — coupled to a CSS class name / private call order, not behavior
expect(page).to have_css('.btn-primary.js-submit')
expect(subject).to have_received(:validate_input).ordered
expect(subject).to have_received(:persist).ordered

# GOOD — assert what a caller/user actually observes
expect(page).to have_button('Submit')
expect(subject.call).to be_success
expect(Membership.count).to eq(1)
```

## 5. Empty smoke test

```ruby
# BAD — SOLE assertion is "didn't crash"
expect { described_class.call(params) }.not_to raise_error

# GOOD — pair with (or replace with) a real behavioral assertion
expect { described_class.call(params) }.to change(Membership, :count).by(1)
result = described_class.call(params)
expect(result.membership).to be_persisted
```

## 6. Asserted name, unasserted value

Examples 6 and 7 are pseudocode: the shape is the same in every language.

```text
# The unit builds a command line; the option's value is meant to stay empty.

# BAD — proves the option is there, not what it carries
invocation = build_invocation(config)
assert invocation contains "--exclude"

# GOOD — the option and its exact value (here, its exact emptiness)
assert invocation contains the pair ("--exclude", "")
# A regression that fills the value with "*.log" now turns this red.
```

## 7. Defeasible negative assertion

```text
# The unit renders a report; the watched term must not appear in its summary.

# BAD — an exact-match absence check
assert output does not contain "status: FAILED"
# A later change wraps the value in quotes: status: "FAILED". The exact string no
# longer matches, the assertion passes, and the watched term is still there.

# GOOD — first prove the region was produced, then aim the absence check at it
summary = section of output under "Summary"
assert summary is not empty
assert no line of summary reports the status FAILED, however it is quoted or wrapped
```

## Mock/assertion ratio — worked example

```ruby
# 7+ mocks: testing at the wrong layer
it 'processes payment' do
  allow(gateway).to receive(:charge).and_return(success_response)
  allow(user).to receive(:notify)
  allow(ledger).to receive(:record)
  allow(receipt_service).to receive(:generate)
  allow(analytics).to receive(:track)
  allow(cache).to receive(:invalidate)
  allow(audit_log).to receive(:write)
  # ... test drowns in setup, asserts almost nothing about actual payment logic
end

# Extract-before-mock: pull the orchestration into a pure result object,
# test the pure logic directly (0 mocks), and keep ONE integration test
# at the service layer with real collaborators (build_stubbed, not 7 mocks).
```

## Source

Adapted from the gentle-ai spike (`sdd-apply/strict-tdd.md` / `sdd-verify/strict-tdd-verify.md`),
translated from JS/Jest examples to RSpec/Ruby for this stack. LEARN-not-ADOPT: only the assertion
quality catalog + mock-ratio guide were grafted; the rest of that pipeline was not adopted.
