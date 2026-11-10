#!/usr/bin/env bash
# SessionStart hook — injects a compact bootstrap pointing at this project's
# Skill Router. Ships to target projects via install.sh's .claude/hooks/
# framework walk; wired in .claude/settings.json under the SessionStart hooks
# key (matcher: startup|clear|compact — compact survival is the point: this
# text must still be present after context is trimmed).
#
# The router may live in CLAUDE.md (team-wide, committed) or CLAUDE.local.md
# (personal, gitignored — some consumer repos keep it there instead so it
# never lands in a commit); either is a valid home, so both are checked.
#
# Silent no-op guard: if neither file exists, or neither contains a Skill
# Router, this hook has nothing to point at — stay silent (empty stdout,
# exit 0) rather than error or nag a repo that merely borrowed it.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"

ROUTER_FILES=()
for candidate in CLAUDE.md CLAUDE.local.md; do
  if [[ -f "$PROJECT_DIR/$candidate" ]] && grep -qi 'Skill Router' "$PROJECT_DIR/$candidate"; then
    ROUTER_FILES+=("$candidate")
  fi
done

if [[ ${#ROUTER_FILES[@]} -eq 0 ]]; then
  exit 0
fi

if [[ ${#ROUTER_FILES[@]} -eq 1 ]]; then
  ROUTER_LABEL="${ROUTER_FILES[0]}"
else
  ROUTER_LABEL="${ROUTER_FILES[0]} and ${ROUTER_FILES[1]}"
fi

# Static and inline (not `cat` of a skill file): names no skill and no router
# row, so renaming/adding a skill never touches this hook (zero new sync
# surface). Keep this under 200 words.
# BOOTSTRAP is interpolated RAW into a JSON string: plain single-line text
# only — no double quotes, no backslashes, no newlines. ROUTER_LABEL is one
# or two filenames joined by " and " (see above) — safe under the same rule.
BOOTSTRAP="You are working in a repository that uses the dojo skill framework. Before you respond to any request, consult the Skill Router in this project's ${ROUTER_LABEL} and invoke the matching skill first: if there is even a 1% chance a skill applies, invoke it before responding — the cost of checking is trivial next to the cost of skipping a process you needed. Process skills (design, test-first, review, investigation, and orchestration) take priority over jumping straight to implementation; they exist to stop you from writing code before the problem is understood, designed, and covered by a failing test. This guidance survives context compaction: if you have lost the thread, re-read the Skill Router in ${ROUTER_LABEL} before continuing. Do not restate the router here — read it there, where it is authoritative and always current."

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$BOOTSTRAP"
