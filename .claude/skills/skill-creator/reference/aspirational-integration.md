# Integration with Orchestrator (Aspirational — NOT IMPLEMENTED)

> **NOT IMPLEMENTED** — skill-creator is **manual-only**. The orchestrator (`orchestrate/SKILL.md`) lists it as a Meta-Skill with zero automatic triggers. The pseudocode below is aspirational design; no session hook or cron fires it automatically.

The ideas below describe what a future automated integration _could_ look like, kept for reference:

## End of Session Hook (aspirational — not wired up)
```ruby
# ASPIRATIONAL PSEUDOCODE — this hook does not exist in the orchestrator.
# Invoke /skill-creator manually when you notice a pattern worth automating.
def end_of_session_hook
  # Analyze session transcript
  patterns = SkillCreator.detect_patterns(session_transcript)

  # Filter candidates (score ≥ 8)
  candidates = patterns.select { |p| p.score >= 8 }

  if candidates.any?
    # Present to user
    puts "\n Skill Creation Opportunities Detected:"
    candidates.each do |c|
      puts "- #{c.name} (ROI: #{c.roi}x, Score: #{c.score}/10)"
    end

    # Ask for review
    puts "\nRun /skill-creator to review proposals? (y/n)"
  end
end
```

## Weekly Aggregation (aspirational — not wired up)
```ruby
# ASPIRATIONAL PSEUDOCODE — no cron or scheduler fires this.
def weekly_skill_report
  # Aggregate patterns across sessions
  cross_session_patterns = analyze_last_7_days

  # Find patterns that appear across multiple sessions
  recurring = cross_session_patterns.select { |p| p.sessions >= 2 }

  # Generate weekly report
  generate_skill_opportunities_report(recurring)
end
```
