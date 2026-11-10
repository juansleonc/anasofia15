#!/usr/bin/env bash
set -euo pipefail
# memory_check.sh - read-only mechanical health check for the project-relative memory/ directory.
# Read-only, no network, no writes — it never edits or deletes anything under <memory-dir>.
# bash-3.2 compatible (no associative arrays, no mapfile).
#
# Scope guard: this script only ever operates on the <memory-dir> argument the caller passes. It
# is never pointed at the Claude Code harness's own memory (~/.claude/projects/.../memory/) — that
# is a different, out-of-scope artifact (see memory-conventions.md "Harness memory — out of scope v1").
#
# Usage:
#   memory_check.sh --report <memory-dir>
#
# Output grammar: every finding is one line, prefixed INFO: or TRIGGERED:.
#
# Exit-code contract:
#   0 - no TRIGGERED lines (clean, or INFO-only)
#   1 - at least one TRIGGERED line present. This is an ADVISORY TRIGGER SIGNAL, not a structural
#       hard-fail: the script itself never aborts or blocks anything. Whether a non-zero exit here
#       actually blocks a workflow is entirely up to the CALLER (see the skills that shell out to
#       this script). A future audit that shells out to this script must not treat exit 1 as a
#       build-breaking defect the way a missing/malformed-marker hard-fail would be elsewhere.
#   2 - usage error
#
# Constants below mirror ../../shared/memory-conventions.md#thresholds exactly — change both
# together, in the same change. No other file restates either digit.
MEMORY_TRIGGER_COUNT=40   # mirrors memory-conventions.md#thresholds
INDEX_CAP=200             # mirrors memory-conventions.md#thresholds

usage() {
  echo "usage: memory_check.sh --report <memory-dir>" >&2
}

# list_memory_files <memory-dir>
# Emits one path per line for every feedback_*.md / reference_*.md / project_*.md file directly
# under <memory-dir> (non-recursive; excludes MEMORY.md itself). A missing/empty <memory-dir>
# yields no output.
list_memory_files() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  find "$dir" -maxdepth 1 -type f \
    \( -name 'feedback_*.md' -o -name 'reference_*.md' -o -name 'project_*.md' \) | sort
}

# frontmatter_value <file> <key>
# Prints the raw value of a top-level YAML frontmatter key (name, description, supersedes,
# corrects, ...), stripped of surrounding double quotes. Empty output if the key is absent. Cheap
# line-based parse over the `---`-delimited header block only — no YAML library.
frontmatter_value() {
  local file="$1" key="$2"
  awk -v k="$key" '
    /^---[[:space:]]*$/ { depth++; next }
    depth==1 {
      if ($0 ~ "^" k ":") {
        sub("^" k ":[[:space:]]*", "")
        gsub(/^"|"$/, "")
        print
        exit
      }
    }
    depth>=2 { exit }
  ' "$file"
}

# check_count <memory-dir>
# Count vs trigger heuristic (memory-conventions.md#thresholds).
check_count() {
  local dir="$1"
  local files count
  files="$(list_memory_files "$dir")"
  count=0
  if [ -n "$files" ]; then
    count="$(printf '%s\n' "$files" | wc -l | tr -d ' ')"
  fi

  if [ "$count" -ge "$MEMORY_TRIGGER_COUNT" ]; then
    echo "TRIGGERED: memory count $count >= trigger $MEMORY_TRIGGER_COUNT — run a distill pass"
  else
    echo "INFO: memory count $count (trigger $MEMORY_TRIGGER_COUNT)"
  fi
}

# check_cap <memory-dir>
# Index-cap heuristic (memory-conventions.md#thresholds). A missing MEMORY.md is treated as 0
# lines — INFO, not TRIGGERED (nothing to cap yet).
check_cap() {
  local dir="$1"
  local index="$dir/MEMORY.md"
  local lines=0
  if [ -f "$index" ]; then
    lines="$(wc -l < "$index" | tr -d ' ')"
  fi

  if [ "$lines" -gt "$INDEX_CAP" ]; then
    echo "TRIGGERED: MEMORY.md $lines lines exceeds cap $INDEX_CAP"
  else
    echo "INFO: MEMORY.md $lines lines (cap $INDEX_CAP)"
  fi
}

# name_index <memory-dir>
# Emits one "<name>|<file>" line per memory file, where <name> is its frontmatter `name:` value
# (falling back to the filename stem if absent). Used to resolve supersedes:/corrects: targets and
# wikilink targets to an actual file without a YAML library.
name_index() {
  local dir="$1" f name
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    name="$(frontmatter_value "$f" name)"
    [ -z "$name" ] && name="$(basename "$f" .md)"
    echo "$name|$f"
  done <<LIST
$(list_memory_files "$dir")
LIST
}

# file_for_name <index> <name>
# Prints the file path registered under <name> in <index> (name_index output), empty if absent.
file_for_name() {
  local index="$1" name="$2"
  printf '%s\n' "$index" | awk -F'|' -v n="$name" '$1==n {print $2; exit}'
}

# check_edges <memory-dir>
# Broken-edge (TRIGGERED) and superseded-but-indexed (TRIGGERED) heuristics
# (memory-conventions.md "File format", "Prune recipe"). supersedes:/corrects: are the two v1 hard
# edges (see memory-conventions.md "Edges (v1)"); a missing target is an integrity defect. A supersedes:
# target that DOES exist but is still bulleted in MEMORY.md is superseded-but-indexed rot.
check_edges() {
  local dir="$1" idx f val target_file target_name key
  local index="$dir/MEMORY.md"
  idx="$(name_index "$dir")"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    for key in supersedes corrects; do
      val="$(frontmatter_value "$f" "$key")"
      [ -z "$val" ] && continue
      target_file="$(file_for_name "$idx" "$val")"
      if [ -z "$target_file" ]; then
        echo "TRIGGERED: broken edge — $(basename "$f"): $key $val (missing)"
        continue
      fi
      if [ "$key" = "supersedes" ] && [ -f "$index" ] && grep -qF "[[$val]]" "$index"; then
        target_name="$(basename "$target_file")"
        echo "TRIGGERED: superseded-but-indexed — $target_name marked superseded but still in MEMORY.md"
      fi
    done
  done <<LIST
$(list_memory_files "$dir")
LIST
}

# check_wikilinks <memory-dir>
# Dangling-wikilink heuristic — INFO, not TRIGGERED (memory-conventions.md#file-format: soft
# relations are advisory, not integrity-enforced). A [[target]] in a file's body that doesn't
# resolve to any known memory name is reported but never escalates the exit code.
check_wikilinks() {
  local dir="$1" idx f token target
  idx="$(name_index "$dir")"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    grep -oE '\[\[[^]]+\]\]' "$f" 2>/dev/null | while IFS= read -r token; do
      target="${token#\[\[}"
      target="${target%\]\]}"
      if [ -z "$(file_for_name "$idx" "$target")" ]; then
        echo "INFO: dangling wikilink — $(basename "$f") -> [[$target]] (no such memory)"
      fi
    done || true
  done <<LIST
$(list_memory_files "$dir")
LIST
}

# normalize <string>
# Near-duplicate normalization pipeline (memory-conventions.md#file-format, cheapest heuristic
# that still catches a renamed-duplicate-under-a-different-filename shape):
#   lowercase -> strip leading feedback_|reference_|project_ -> strip .md -> delete YYYY-MM-DD
#   and bare 4-digit-year runs -> _/- -> space -> squeeze -> trim.
# Plain POSIX awk, no {n} interval syntax (portability), no YAML/embeddings.
normalize() {
  printf '%s' "$1" | awk '{
    s = tolower($0)
    sub(/^(feedback_|reference_|project_)/, "", s)
    sub(/\.md$/, "", s)
    gsub(/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/, "", s)
    gsub(/[0-9][0-9][0-9][0-9]/, "", s)
    gsub(/[_-]/, " ", s)
    gsub(/[ \t]+/, " ", s)
    gsub(/^ +/, "", s)
    gsub(/ +$/, "", s)
    print s
  }'
}

# key_match <a> <b>
# True iff two normalized keys are equal or one contains the other (substring containment).
# Empty keys never match (a missing description must not manufacture a false duplicate).
key_match() {
  local a="$1" b="$2"
  [ -n "$a" ] || return 1
  [ -n "$b" ] || return 1
  [ "$a" = "$b" ] && return 0
  case "$b" in
    *"$a"*) return 0 ;;
  esac
  case "$a" in
    *"$b"*) return 0 ;;
  esac
  return 1
}

# mutual_exempt <memory-dir> <file-a> <name-a> <file-b> <name-b>
# Mutual-wikilink exemption: suppress a near-duplicate finding iff A and B [[wikilink]] each other
# by name — a curated cross-linked pair, not rot. One-directional linking is NOT exempt. Names are
# resolved once by the caller (check_duplicates) rather than rebuilt per pair.
mutual_exempt() {
  local a="$2" a_name="$3" b="$4" b_name="$5"
  grep -qF "[[$b_name]]" "$a" 2>/dev/null && grep -qF "[[$a_name]]" "$b" 2>/dev/null
}

# check_duplicates <memory-dir>
# Near-duplicate heuristic (TRIGGERED): pairwise slug-key and title-key comparison over every
# memory file, skipping mutually-wikilinked pairs. slug-key catches "duplicate folders" (same
# normalized filename under different tiers); title-key catches a misleading filename (different
# filenames, same normalized frontmatter description).
check_duplicates() {
  local dir="$1"
  local files=() slugs=() titles=() names=()
  local f desc slugkey titlekey namekey idx
  idx="$(name_index "$dir")"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    files+=("$f")
    slugkey="$(normalize "$(basename "$f")")"
    desc="$(frontmatter_value "$f" description)"
    titlekey="$(normalize "$desc")"
    namekey="$(printf '%s\n' "$idx" | awk -F'|' -v tf="$f" '$2==tf {print $1; exit}')"
    [ -n "$namekey" ] || namekey="$(basename "$f" .md)"
    slugs+=("$slugkey")
    titles+=("$titlekey")
    names+=("$namekey")
  done <<LIST
$(list_memory_files "$dir")
LIST

  local count=${#files[@]}
  local i=0 j reason
  while [ "$i" -lt "$count" ]; do
    j=$((i + 1))
    while [ "$j" -lt "$count" ]; do
      reason=""
      if key_match "${slugs[$i]}" "${slugs[$j]}"; then
        reason="slug"
      elif key_match "${titles[$i]}" "${titles[$j]}"; then
        reason="title"
      fi
      if [ -n "$reason" ] && ! mutual_exempt "$dir" "${files[$i]}" "${names[$i]}" "${files[$j]}" "${names[$j]}"; then
        echo "TRIGGERED: near-duplicate — $(basename "${files[$i]}") ~ $(basename "${files[$j]}") ($reason)"
      fi
      j=$((j + 1))
    done
    i=$((i + 1))
  done
}

cmd_report() {
  local dir="$1"
  check_count "$dir"
  check_cap "$dir"
  check_edges "$dir"
  check_wikilinks "$dir"
  check_duplicates "$dir"
}

main() {
  local mode="${1:-}"
  case "$mode" in
    --report)
      [ $# -ge 2 ] || { usage; exit 2; }
      local out
      out="$(cmd_report "$2")"
      printf '%s\n' "$out"
      if printf '%s\n' "$out" | grep -q '^TRIGGERED:'; then
        exit 1
      fi
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
}

main "$@"
