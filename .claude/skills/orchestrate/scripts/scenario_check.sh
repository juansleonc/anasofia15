#!/usr/bin/env bash
set -uo pipefail
# scenario_check.sh — single-sourced dojo-side enforcement of the scenarios-as-contracts rule
# for an OpenSpec change on `schema: dojo`. Called by qa_audit's [scenarios] check and by
# /orchestrate's gates, so the two can never silently disagree on what passes.
#
# Usage:
#   scenario_check.sh [--specs] [--tasks] [--verify] <change-dir>
#   scenario_check.sh --ids <change-dir>
#   scenario_check.sh --tree <change-dir>
#   scenario_check.sh --scenarios <path/to/scenarios.md>
#
# Output: one `OK:` or `FAIL: <file>:<line>: <reason>` line per sub-check (for the first form),
# then a final `RESULT: PASS|FAIL` line. --ids/--tree print their requested value directly, with
# no OK/FAIL/RESULT framing. Exit 0 on PASS, 1 on FAIL, 2 on a usage or precondition error.
#
# bash-3.2-safe: no `mapfile`, no `declare -A`, no `sort -V`. Every `case` arm nested inside a
# `$(...)` command substitution in this file carries a leading `(` — stock macOS /bin/bash 3.2
# misparses a bare `pattern)` arm there as closing the substitution itself (see qa_audit.sh's own
# long-form comment on this for the full mechanism).

usage() {
  cat <<'USAGE' >&2
Usage: scenario_check.sh [--specs] [--tasks] [--verify] <change-dir>
       scenario_check.sh --ids <change-dir>
       scenario_check.sh --tree <change-dir>
       scenario_check.sh --scenarios <path/to/scenarios.md>
USAGE
}

# trim STR — STR with leading and trailing [:space:] stripped. Shared by every parsing helper in
# this file that pulls a field out of a YAML/table/line value.
trim() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

# has_field_token LINE TOKEN — true (0) iff LINE contains TOKEN immediately followed by `:`, with
# TOKEN preceded by the start of the line, a space, or the `·` field separator used in a tasks.md
# line — so e.g. a search for the `file:` field is never satisfied by `profile:` just because it
# ends in the same four letters.
has_field_token() {
  printf '%s\n' "$1" | grep -qE "(^|[ ·])${2}:"
}

# yaml_schema_value FILE — prints the value of FILE's top-level `schema:` key (first match),
# tolerant of a trailing CRLF, a trailing ` # comment`, surrounding whitespace, and a single
# matching pair of quotes. Prints nothing if FILE doesn't exist or has no `schema:` key. Same
# shape as install.sh's and qa_audit.sh's own copies — each script owns its own, deliberately not
# shared, so none of the three can accidentally diverge from the others via a shared-file edit.
yaml_schema_value() {
  local file="$1" raw
  [ -f "$file" ] || { printf ''; return; }
  raw="$(awk -F': *' '/^schema:/{print $2; exit}' "$file" 2>/dev/null || true)"
  raw="$(trim "$raw")"
  raw="$(printf '%s' "$raw" | sed -e 's/[[:space:]]#.*$//')"
  raw="$(trim "$raw")"
  case "$raw" in
    (\"*\") raw="${raw#\"}"; raw="${raw%\"}" ;;
    (\'*\') raw="${raw#\'}"; raw="${raw%\'}" ;;
  esac
  printf '%s' "$raw"
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
DO_SPECS=0
DO_TASKS=0
DO_VERIFY=0
MODE=""
POSITIONAL=""

while [ $# -gt 0 ]; do
  case "$1" in
    (--specs)
      case "$MODE" in
        (""|check) MODE="check"; DO_SPECS=1 ;;
        (*) usage; exit 2 ;;
      esac
      shift ;;
    (--tasks)
      case "$MODE" in
        (""|check) MODE="check"; DO_TASKS=1 ;;
        (*) usage; exit 2 ;;
      esac
      shift ;;
    (--verify)
      case "$MODE" in
        (""|check) MODE="check"; DO_VERIFY=1 ;;
        (*) usage; exit 2 ;;
      esac
      shift ;;
    (--ids)
      [ -n "$MODE" ] && { usage; exit 2; }
      MODE="ids"
      shift ;;
    (--tree)
      [ -n "$MODE" ] && { usage; exit 2; }
      MODE="tree"
      shift ;;
    (--scenarios)
      [ -n "$MODE" ] && { usage; exit 2; }
      MODE="scenarios"
      shift ;;
    (--*)
      usage
      exit 2 ;;
    (*)
      [ -n "$POSITIONAL" ] && { usage; exit 2; }
      POSITIONAL="$1"
      shift ;;
  esac
done

if [ -z "$MODE" ] || [ -z "$POSITIONAL" ]; then
  usage
  exit 2
fi

CHANGE_DIR=""
SCENARIOS_FILE=""
case "$MODE" in
  (scenarios)
    SCENARIOS_FILE="$POSITIONAL"
    ;;
  (*)
    CHANGE_DIR="$POSITIONAL"
    ;;
esac

# ---------------------------------------------------------------------------
# Repo root: resolved from the change dir (or the scenarios file's directory in --scenarios
# mode), never from this process's cwd, so a caller invoking this script with a relative
# change-dir from elsewhere still resolves correctly. No repo found is a precondition failure
# for every mode, --tree included — compute_tree_hash and fail_reused_ids both need a real
# REPO_ROOT to do anything meaningful, and silently no-op'ing there would hide a real
# misconfiguration instead of reporting it.
# ---------------------------------------------------------------------------
REPO_ROOT_BASE="$CHANGE_DIR"
[ -n "$REPO_ROOT_BASE" ] || REPO_ROOT_BASE="$(dirname "$SCENARIOS_FILE")"
REPO_ROOT="$(git -C "$REPO_ROOT_BASE" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo "error: $REPO_ROOT_BASE is not inside a git repository" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Precondition (all change-dir modes): POSITIONAL/.openspec.yaml must pin schema: dojo. The
# --scenarios mode takes a scenarios.md path directly (fast-path has no .openspec.yaml at all),
# so it is the one mode this precondition never applies to.
# ---------------------------------------------------------------------------
if [ "$MODE" != "scenarios" ]; then
  if [ "$(yaml_schema_value "$CHANGE_DIR/.openspec.yaml")" != "dojo" ]; then
    echo "error: $CHANGE_DIR is not a dojo-schema change" >&2
    exit 2
  fi
fi

FAIL_COUNT=0

# section_heading_label LINE — prints ADDED/MODIFIED/REMOVED/RENAMED iff LINE is a `## ... Re-
# quirements` section heading of that kind, matched case-insensitively (OpenSpec 1.1.0 accepts
# e.g. "## Added requirements" as equivalent to "## ADDED Requirements"), else prints nothing.
section_heading_label() {
  local lower
  lower="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    ("## added requirements"*) printf 'ADDED' ;;
    ("## modified requirements"*) printf 'MODIFIED' ;;
    ("## removed requirements"*) printf 'REMOVED' ;;
    ("## renamed requirements"*) printf 'RENAMED' ;;
  esac
}

# scan_scenario_headers FILE REL_LABEL — scans FILE line by line for `#### Scenario: <ID>: <name>`
# headers, printing one `ID|REL_LABEL:line|section` row per well-formed header found (`section` is
# the nearest preceding `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` heading in the same file,
# matched case-insensitively via section_heading_label, or empty if none seen yet). A malformed
# header (wrong ID shape) echoes a FAIL line directly and increments FAIL_COUNT instead of
# contributing a row — a malformed ID can't meaningfully participate in the uniqueness/reuse
# checks keyed on ID shape. A file with zero headers at all FAILs too. Shared by
# collect_scenario_ids (one call per specs/**/spec.md) and check_scenarios_file (a single
# fast-path scenarios.md).
scan_scenario_headers() {
  local file="$1"
  local rel="$2"
  local section="" lineno=0 header_count=0 line new_section
  while IFS= read -r line; do
    lineno=$((lineno + 1))
    new_section="$(section_heading_label "$line")"
    [ -n "$new_section" ] && section="$new_section"
    case "$line" in
      ("#### Scenario:"*)
        header_count=$((header_count + 1))
        if printf '%s\n' "$line" | grep -qE '^#### Scenario: [A-Z]{2,6}-[0-9]{3}: .+$'; then
          local id
          id="$(printf '%s\n' "$line" | sed -E 's/^#### Scenario: ([A-Z]{2,6}-[0-9]{3}):.*/\1/')"
          printf '%s|%s:%s|%s\n' "$id" "$rel" "$lineno" "$section"
        else
          echo "FAIL: $rel:$lineno: malformed scenario header (expected '#### Scenario: <ID>: <name>', ID shape [A-Z]{2,6}-[0-9]{3})"
          FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
        ;;
    esac
  done < "$file"
  if [ "$header_count" -eq 0 ]; then
    echo "FAIL: $rel:0: zero scenario headers"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# collect_scenario_ids DIR — scan_scenario_headers applied to every DIR/specs/**/spec.md, in
# file-then-line order. `file` in each row is relative to DIR.
collect_scenario_ids() {
  local dir="$1"
  local specs_dir="$dir/specs"
  [ -d "$specs_dir" ] || return
  local spec_file
  while IFS= read -r spec_file; do
    [ -z "$spec_file" ] && continue
    scan_scenario_headers "$spec_file" "${spec_file#"$dir"/}"
  done < <(find "$specs_dir" -name 'spec.md' | sort)
}

# collect_rows_into_global FN ARGS... — runs FN ARGS... directly (never wrapped in a command-
# substitution subshell — `x="$(collect_rows_into_global ...)"` would run THIS WHOLE function in
# a subshell too, discarding any FAIL_COUNT update FN made internally). Echoes FN's own FAIL lines
# straight to this process's real stdout, and leaves the remaining (non-FAIL) rows in the global
# ROWS_RESULT for the caller to read immediately after this call returns — bash 3.2 has no
# `local -n`, so a global out-parameter is the portable substitute for a true by-reference return.
collect_rows_into_global() {
  local tmp_rows
  tmp_rows="$(mktemp)"
  "$@" > "$tmp_rows"
  grep '^FAIL: ' "$tmp_rows" || true
  ROWS_RESULT="$(grep -v '^FAIL: ' "$tmp_rows" || true)"
  rm -f "$tmp_rows"
}

# fail_duplicate_ids ROWS — given newline rows `ID|loc|section`, FAILs (incrementing FAIL_COUNT)
# once per ID appearing at 2+ locations, naming the first location and all locations found.
fail_duplicate_ids() {
  local rows="$1"
  local dup_ids dup_id
  dup_ids="$(printf '%s\n' "$rows" | awk -F'|' 'NF>=2{print $1}' | sort | uniq -d)"
  while IFS= read -r dup_id; do
    [ -z "$dup_id" ] && continue
    local locs first_loc
    locs="$(printf '%s\n' "$rows" | awk -F'|' -v id="$dup_id" '$1==id{print $2}' | tr '\n' ' ' | sed 's/ $//')"
    first_loc="${locs%% *}"
    echo "FAIL: $first_loc: duplicate scenario ID $dup_id (also at: $locs)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  done <<DUPIDS
$dup_ids
DUPIDS
}

# fail_reused_ids ROWS REQUIRE_ADDED — for each row (`ID|loc|section`), checks reuse against
# openspec/specs/** (live) and openspec/changes/archive/** (retired). A row whose section is empty
# or not one of ADDED/MODIFIED/REMOVED/RENAMED (an unrecognized heading, or no heading seen at all)
# is treated as ADDED here — fail closed, since an unrecognized section is never grounds to skip
# the reuse check. With REQUIRE_ADDED=1 (check_specs): an ADDED-section ID FAILs if it exists live
# OR retired; a REMOVED- or RENAMED-section ID is never checked here; a MODIFIED-section ID is
# expected to match a live spec (a full-block copy), so it only FAILs if it exists in archive/**
# but NOT in specs/** — a MODIFIED claim on an ID that was never live, only retired, is reuse of a
# retired ID wearing a MODIFIED label. With REQUIRE_ADDED=0 (check_scenarios_file's fast-path
# scenarios.md, which has no ADDED/MODIFIED split — every ID in it is new) every ID FAILs if it
# exists live or retired.
fail_reused_ids() {
  local rows="$1"
  local require_added="$2"
  [ -n "$REPO_ROOT" ] || return
  local specs_dir="$REPO_ROOT/openspec/specs"
  local archive_dir="$REPO_ROOT/openspec/changes/archive"
  [ -d "$specs_dir" ] || [ -d "$archive_dir" ] || return
  local row
  while IFS= read -r row; do
    [ -z "$row" ] && continue
    local id loc section
    IFS='|' read -r id loc section <<EOF
$row
EOF
    case "$section" in
      (ADDED|MODIFIED|REMOVED|RENAMED) ;;
      (*) section="ADDED" ;;
    esac
    if [ "$require_added" -eq 1 ] && [ "$section" != "ADDED" ] && [ "$section" != "MODIFIED" ]; then
      continue
    fi
    # Only grep a directory that actually exists — under `set -o pipefail` (this script's own
    # shebang line), a nonexistent path makes grep itself exit non-zero, and that nonzero status
    # would otherwise defeat the `&&`/`||` chain below.
    local in_live=1 in_archive=1
    [ -d "$specs_dir" ] && grep -rlE "^#### Scenario: ${id}:" "$specs_dir" 2>/dev/null | grep -q . || in_live=0
    [ -d "$archive_dir" ] && grep -rlE "^#### Scenario: ${id}:" "$archive_dir" 2>/dev/null | grep -q . || in_archive=0
    if [ "$require_added" -eq 1 ] && [ "$section" = "MODIFIED" ]; then
      if [ "$in_live" -eq 0 ] && [ "$in_archive" -eq 1 ]; then
        echo "FAIL: $loc: scenario ID $id under MODIFIED Requirements has no live spec (found only in openspec/changes/archive/**)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
      fi
      continue
    fi
    if [ "$in_live" -eq 1 ] || [ "$in_archive" -eq 1 ]; then
      echo "FAIL: $loc: scenario ID $id reuses a live or retired ID (openspec/specs/** or openspec/changes/archive/**)"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  done <<ROWS
$rows
ROWS
}

# check_specs CHANGE_DIR — validates every scenario header under CHANGE_DIR/specs/**/spec.md:
# format + zero-headers (collect_scenario_ids/scan_scenario_headers), no specs/ at all,
# within-change ID uniqueness (fail_duplicate_ids), and no ID reuse against openspec/specs/** or
# openspec/changes/archive/** for an ID declared under ## ADDED Requirements (fail_reused_ids,
# REQUIRE_ADDED=1).
check_specs() {
  local change_dir="$1"
  local specs_dir="$change_dir/specs"
  if [ ! -d "$specs_dir" ]; then
    echo "FAIL: $change_dir/specs:0: no specs/ directory"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if [ -z "$(find "$specs_dir" -name 'spec.md')" ]; then
    echo "FAIL: $specs_dir:0: no spec.md files found"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  collect_rows_into_global collect_scenario_ids "$change_dir"
  local real_rows="$ROWS_RESULT"
  fail_duplicate_ids "$real_rows"
  fail_reused_ids "$real_rows" 1
}

# check_scenarios_file FILE — applies the --specs format/uniqueness/reuse rules to a single
# fast-path scenarios.md: format + zero-headers, within-file ID uniqueness, and reuse
# against openspec/specs/** / openspec/changes/archive/** for every ID (fail_reused_ids,
# REQUIRE_ADDED=0 — a fast-path file has no ADDED/MODIFIED split, so reuse always applies).
check_scenarios_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "FAIL: $file:0: scenarios.md absent"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  collect_rows_into_global scan_scenario_headers "$file" "$(basename "$file")"
  local real_rows="$ROWS_RESULT"
  fail_duplicate_ids "$real_rows"
  fail_reused_ids "$real_rows" 0
}

# known_scenario_ids CHANGE_DIR — every well-formed scenario ID declared under
# CHANGE_DIR/specs/**/spec.md, sorted, unique. Malformed-header FAIL lines from
# collect_scenario_ids are dropped here — they are check_specs's job to report, not this
# function's caller's.
known_scenario_ids() {
  collect_scenario_ids "$1" 2>/dev/null | grep -v '^FAIL: ' | awk -F'|' '{print $1}' | sort -u
}

# check_tasks CHANGE_DIR — validates CHANGE_DIR/tasks.md: the file exists; every `- [ ]`/`- [x]`
# task line carries `file:`, `test:`, and `scenarios:` as field tokens (has_field_token — a
# substring like `profile:`/`contest:` never satisfies this), naming each missing field by name;
# every ID after `scenarios:` is a known scenario ID (declared in this change's own specs); and
# every known scenario ID is referenced by at least one task (coverage in both directions).
check_tasks() {
  local change_dir="$1"
  local tasks_file="$change_dir/tasks.md"
  if [ ! -f "$tasks_file" ]; then
    echo "FAIL: $change_dir/tasks.md:0: tasks.md absent"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi

  local known_ids
  known_ids="$(known_scenario_ids "$change_dir")"

  local referenced_tmp
  referenced_tmp="$(mktemp)"

  local lineno=0
  local line
  while IFS= read -r line; do
    lineno=$((lineno + 1))
    case "$line" in
      ("- [ ] "*|"- [x] "*)
        local has_file=0 has_test=0 has_scenarios=0 missing=""
        has_field_token "$line" "file" && has_file=1
        has_field_token "$line" "test" && has_test=1
        has_field_token "$line" "scenarios" && has_scenarios=1
        [ "$has_file" -eq 0 ] && missing="${missing:+$missing, }file:"
        [ "$has_test" -eq 0 ] && missing="${missing:+$missing, }test:"
        [ "$has_scenarios" -eq 0 ] && missing="${missing:+$missing, }scenarios:"
        if [ -n "$missing" ]; then
          echo "FAIL: tasks.md:$lineno: task line missing $missing"
          FAIL_COUNT=$((FAIL_COUNT + 1))
        else
          local scen_part
          scen_part="$(printf '%s' "$line" | sed -E 's/.*scenarios: *//')"
          local tok
          while IFS= read -r tok; do
            tok="$(trim "$tok")"
            [ -z "$tok" ] && continue
            printf '%s\n' "$tok" >> "$referenced_tmp"
            if ! printf '%s\n' "$known_ids" | grep -qxF "$tok"; then
              echo "FAIL: tasks.md:$lineno: scenarios: ID $tok is not defined in this change's specs"
              FAIL_COUNT=$((FAIL_COUNT + 1))
            fi
          done < <(printf '%s\n' "$scen_part" | tr ',' '\n')
        fi
        ;;
    esac
  done < "$tasks_file"

  local referenced_ids
  referenced_ids="$(sort -u "$referenced_tmp")"
  rm -f "$referenced_tmp"

  local id
  while IFS= read -r id; do
    [ -z "$id" ] && continue
    if ! printf '%s\n' "$referenced_ids" | grep -qxF "$id"; then
      echo "FAIL: tasks.md:0: scenario ID $id is declared in specs but referenced by no task"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  done <<KNOWNIDS
$known_ids
KNOWNIDS
}

# scenario_matrix_rows CHANGE_DIR — one `ID|Evidence level|Result` row per real (non-header,
# non-separator) `| ... |` row of CHANGE_DIR/verify-report.md's `## Scenario Matrix` table, each
# field trimmed. Empty if verify-report.md or the table section is absent.
scenario_matrix_rows() {
  local change_dir="$1"
  local file="$change_dir/verify-report.md"
  [ -f "$file" ] || return
  local table_lines
  table_lines="$(awk '
    /^## Scenario Matrix/ { f=1; next }
    f && /^## / { exit }
    f && /^\|/ { print }
  ' "$file")"
  local row
  while IFS= read -r row; do
    [ -z "$row" ] && continue
    case "$row" in
      (*"---"*) continue ;;
      (*"Scenario ID"*"Evidence level"*) continue ;;
    esac
    local body id evidence result
    body="${row#|}"
    body="${body%|}"
    # shellcheck disable=SC2034 # the "Test / command" column is read but intentionally unused —
    # this function only ever reports ID/Evidence level/Result
    IFS='|' read -r id _test_cmd evidence result <<EOF
$body
EOF
    id="$(trim "$id")"
    evidence="$(trim "$evidence")"
    result="$(trim "$result")"
    printf '%s|%s|%s\n' "$id" "$evidence" "$result"
  done <<TABLE
$table_lines
TABLE
}

# check_verify CHANGE_DIR — validates CHANGE_DIR/verify-report.md: the file exists; `## Verdict`'s
# body is exactly `PASS`; the change's known scenario-ID set is non-empty (an empty set can never
# be meaningfully verified — a missing/emptied specs/ would otherwise let any verify-report.md
# through vacuously); every known scenario ID has a `## Scenario Matrix` row; every row's Evidence
# level is one of the 5 ladder tokens (behavior-verified, test-verified, static-only, blocked,
# failed) from `.claude/agents/validator.md` (cited, never restated) and is never
# `blocked`/`failed`; every row's Result is exactly `PASS`; and a `PASS` Verdict never coexists
# with a failing row.
check_verify() {
  local change_dir="$1"
  local file="$change_dir/verify-report.md"
  if [ ! -f "$file" ]; then
    echo "FAIL: $change_dir/verify-report.md:0: verify-report.md absent"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi

  local verdict
  verdict="$(awk '/^## Verdict/{f=1; next} f && /^## /{exit} f{print}' "$file" \
    | grep -vE '^[[:space:]]*$|^<!--')"
  verdict="$(trim "$verdict")"
  if [ "$verdict" != "PASS" ]; then
    echo "FAIL: verify-report.md:0: ## Verdict is not exactly PASS (got: ${verdict:-<empty>})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  local known_ids
  known_ids="$(known_scenario_ids "$change_dir")"
  if [ -z "$known_ids" ]; then
    echo "FAIL: verify-report.md:0: no known scenario IDs for $change_dir (an empty contract cannot be verified)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  local rows
  rows="$(scenario_matrix_rows "$change_dir")"

  local any_row_bad=0
  local id
  while IFS= read -r id; do
    [ -z "$id" ] && continue
    if ! printf '%s\n' "$rows" | awk -F'|' -v want="$id" '$1==want{found=1} END{exit !found}'; then
      echo "FAIL: verify-report.md:0: scenario ID $id has no Scenario Matrix row"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      any_row_bad=1
    fi
  done <<KNOWNIDS2
$known_ids
KNOWNIDS2

  local rid revidence rresult
  while IFS='|' read -r rid revidence rresult; do
    [ -z "$rid" ] && continue
    case "$revidence" in
      (behavior-verified|test-verified|static-only|blocked|failed) ;;
      (*)
        echo "FAIL: verify-report.md:0: $rid row's Evidence level '$revidence' is not one of the 5 ladder tokens"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        any_row_bad=1
        continue
        ;;
    esac
    case "$revidence" in
      (blocked|failed)
        echo "FAIL: verify-report.md:0: $rid row's Evidence level is $revidence (not a pass)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        any_row_bad=1
        ;;
    esac
    if [ "$rresult" != "PASS" ]; then
      echo "FAIL: verify-report.md:0: $rid row's Result is not PASS (got: ${rresult:-<empty>})"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      any_row_bad=1
    fi
  done <<ROWS2
$rows
ROWS2

  if [ "$verdict" = "PASS" ] && [ "$any_row_bad" -eq 1 ]; then
    echo "FAIL: verify-report.md:0: Verdict is PASS but at least one Scenario Matrix row fails"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  # Evidence-tree staleness: a tasks.md checkbox tick is never evidence on its own — the Evidence
  # Basis `tree: <hash>` must match the CURRENT working tree (excluding verify-report.md and
  # tasks.md themselves, see compute_tree_hash), or this run is reporting against a tree that has
  # since moved.
  local evidence_basis evidence_hash current_hash
  evidence_basis="$(awk '/^## Evidence Basis/{f=1;next} f && /^## /{exit} f{print}' "$file")"
  evidence_hash="$(printf '%s\n' "$evidence_basis" | grep -oE 'tree: [0-9a-f]+' | head -1 | awk '{print $2}')"
  current_hash="$(compute_tree_hash "$change_dir")"
  if [ -z "$evidence_hash" ] || [ "$evidence_hash" != "$current_hash" ]; then
    echo "FAIL: verify-report.md:0: stale evidence (Evidence Basis tree: ${evidence_hash:-<missing>}, current tree: ${current_hash:-<unknown>})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# compute_tree_hash CHANGE_DIR — `git write-tree` of the whole working tree under a disposable
# temp index, excluding CHANGE_DIR/verify-report.md and CHANGE_DIR/tasks.md: the two files a
# verify run itself writes/ticks, so neither can make the hash "move" relative to the code it is
# meant to attest. The temp index is seeded by COPYING the real, on-disk index
# (`env -u GIT_INDEX_FILE git rev-parse --git-path index`, resolved with GIT_INDEX_FILE genuinely
# unset — not merely set to an empty value, which git treats as an explicit override and resolves
# to the wrong path — so it names the real file even though this function has already exported
# GIT_INDEX_FILE for the temp index) — that real index already holds any path staged (e.g.
# force-added) but not yet committed,
# which `git read-tree HEAD` alone would miss entirely for a change with no commits yet. Only when
# no real index file exists at all does this fall back to `git read-tree HEAD` (when a commit
# exists) or a bare empty index (brand new repo, nothing ever staged). THEN `git add -A` layers
# the working tree on top — seeding matters because `git add -A` against a bare empty index treats
# every path as untracked and skips anything .gitignore excludes, even a path that IS tracked
# (force-added) in the real index; seeding first means an edit to such a tracked-but-ignored file
# is still picked up as a modification. The real git index (`.git/index`) is only ever READ here
# (via `cp`), never written — GIT_INDEX_FILE points git's own writes at a throwaway file instead,
# deleted at the end. Prints nothing if REPO_ROOT could not be resolved (not a git repo).
compute_tree_hash() {
  local change_dir="$1"
  [ -n "$REPO_ROOT" ] || return
  local abs_change_dir
  case "$change_dir" in
    (/*) abs_change_dir="$change_dir" ;;
    (*) abs_change_dir="$(pwd)/$change_dir" ;;
  esac
  [ -d "$abs_change_dir" ] && abs_change_dir="$(cd "$abs_change_dir" && pwd)"
  local rel_change_dir="${abs_change_dir#"$REPO_ROOT"/}"

  local tmp_index
  tmp_index="$(mktemp -u)"
  (
    cd "$REPO_ROOT" || exit 1
    export GIT_INDEX_FILE="$tmp_index"
    real_index="$(env -u GIT_INDEX_FILE git rev-parse --git-path index 2>/dev/null)"
    if [ -n "$real_index" ] && [ -f "$real_index" ]; then
      cp "$real_index" "$tmp_index"
    elif git rev-parse --verify -q HEAD >/dev/null 2>&1; then
      git read-tree HEAD
    fi
    git add -A -- . >/dev/null 2>&1
    git rm --cached -q --ignore-unmatch -- \
      "$rel_change_dir/verify-report.md" "$rel_change_dir/tasks.md" >/dev/null 2>&1
    git write-tree
  )
  rm -f "$tmp_index"
}

# run_subcheck NAME FN CHANGE_DIR — calls FN CHANGE_DIR, then prints one OK line for NAME iff FN
# added no new FAIL_COUNT itself — never gated on the script-wide FAIL_COUNT, which may already be
# nonzero from an earlier --specs/--tasks/--verify combined on the same invocation.
run_subcheck() {
  local name="$1" fn="$2" change_dir="$3" fail_before="$FAIL_COUNT"
  "$fn" "$change_dir"
  if [ "$FAIL_COUNT" -eq "$fail_before" ]; then
    echo "OK: $name"
  fi
}

case "$MODE" in
  (check)
    [ "$DO_SPECS" -eq 1 ] && run_subcheck \
      "--specs: every scenario header is well-formed, unique, and reuses no live/retired ID" \
      check_specs "$CHANGE_DIR"
    [ "$DO_TASKS" -eq 1 ] && run_subcheck \
      "--tasks: every task names file/test/scenarios, every ID is known, every known ID is covered" \
      check_tasks "$CHANGE_DIR"
    [ "$DO_VERIFY" -eq 1 ] && run_subcheck \
      "--verify: verify-report.md has a PASS verdict with a complete, passing scenario matrix" \
      check_verify "$CHANGE_DIR"
    if [ "$FAIL_COUNT" -gt 0 ]; then
      echo "RESULT: FAIL"
      exit 1
    fi
    echo "RESULT: PASS"
    exit 0
    ;;
  (ids)
    known_scenario_ids "$CHANGE_DIR"
    exit 0
    ;;
  (tree)
    compute_tree_hash "$CHANGE_DIR"
    exit 0
    ;;
  (scenarios)
    run_subcheck \
      "--scenarios: every scenario header in $SCENARIOS_FILE is well-formed, unique, and reuses no live/retired ID" \
      check_scenarios_file "$SCENARIOS_FILE"
    if [ "$FAIL_COUNT" -gt 0 ]; then
      echo "RESULT: FAIL"
      exit 1
    fi
    echo "RESULT: PASS"
    exit 0
    ;;
esac
