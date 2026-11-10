# Detection Algorithm — Scoring (7 Criteria)

A pattern qualifies as "skill candidate" when:

```ruby
def skill_candidate?(pattern)
  score = 0

  # 🔴 CRITICAL: Pre-filter - Must be implemented code
  return :ignore if pattern.exploration_or_planning?  # NOT implemented yet
  return :ignore if pattern.future_feature?           # No code exists
  return :ignore if pattern.prototype_phase?          # May change completely

  # Frequency criteria
  score += 3 if pattern.occurrences >= 3  # Happened 3+ times
  score += 2 if pattern.time_wasted >= 25.minutes  # Saves 25+ min

  # Complexity criteria
  score += 2 if pattern.steps >= 5  # Multi-step process
  score += 1 if pattern.tools_used >= 3  # Uses 3+ tools

  # Standardization criteria
  score += 2 if pattern.consistency >= 0.8  # 80% similar each time
  score += 1 if pattern.outcome_predictable?  # Same goal each time

  # Value criteria
  score += 2 if pattern.manual_and_tedious?  # Error-prone if manual
  score += 1 if pattern.affects_multiple_devs?  # Team benefit

  # Implementation validation (NEW)
  score += 3 if pattern.operates_on_existing_code?  # Works on real codebase
  score += 2 if pattern.validated_with_real_data?   # Tested on actual files

  # Disqualifiers
  score = 0 if pattern.one_off?  # One-time tasks
  score = 0 if pattern.already_has_skill?  # Existing skill covers it

  # Decision
  if score >= 8
    :create_skill  # Strong candidate
  elsif score >= 5
    :monitor  # Watch for more occurrences
  else
    :ignore  # Not worth automating
  end
end
```
