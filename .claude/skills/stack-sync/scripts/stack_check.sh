#!/usr/bin/env bash
set -euo pipefail
# stack_check.sh - mechanical detector/parser shared by /stack-sync --check and qa_audit Check 9.
# Read-only, no network, no writes. Mirrors qa_audit.sh's mechanical/generative split precedent:
# this script owns everything that can be verified by a script; the SKILL.md prose owns the
# research/propose/approve/write half that can't be.
#
# Modes:
#   --detect   <scan-dir>                         bounded lockfile/config detection
#   --report   <scan-dir> <best-practices-file>   drift report (unregistered/stale/version-drift),
#                                                  read-only, ALWAYS exits 0
#   --audit    <scan-dir> <best-practices-file>   exit 1 ONLY on a malformed/missing
#                                                  stack-sync:tech marker; drift/staleness are
#                                                  printed WARNINGs that never affect the exit code
#
# The stack-sync:tech marker shape parsed here is defined in exactly one place:
# ../reference/best-practices-schema.md. The stack-sync:tech marker shape is parsed by this
# script AND written by the stack-sync skill — change both together, in the same change.

STALE_DAYS=90
VALID_SOURCES="context7 web repo-only"

usage() {
  echo "usage: stack_check.sh --detect <scan-dir>" >&2
  echo "       stack_check.sh --report <scan-dir> <best-practices-file>" >&2
  echo "       stack_check.sh --audit <scan-dir> <best-practices-file>" >&2
}

# parse_sections <file>
# Emits one line per `## ` section found in <file>:
#   OK|<heading>|<name>|<version>|<stamped>|<source>          — well-formed marker
#   MALFORMED|<heading>|(missing marker)                      — heading with no marker at all
# A missing <file> yields no output (first-run: best-practices.md doesn't exist yet).
parse_sections() {
  local file="$1"
  [ -f "$file" ] || return 0
  awk '
    /^## / {
      if (heading != "" && have_marker == 0) {
        print "MALFORMED|" heading "|(missing marker)"
      }
      heading = substr($0, 4)
      have_marker = 0
      next
    }
    /<!-- stack-sync:tech / {
      have_marker = 1
      line = $0
      name = ""; version = ""; stamped = ""; src = ""
      if (match(line, /name="[^"]*"/))    { name    = substr(line, RSTART + 6, RLENGTH - 7) }
      if (match(line, /version="[^"]*"/)) { version = substr(line, RSTART + 9, RLENGTH - 10) }
      if (match(line, /stamped="[^"]*"/)) { stamped = substr(line, RSTART + 9, RLENGTH - 10) }
      if (match(line, /source="[^"]*"/))  { src     = substr(line, RSTART + 8, RLENGTH - 9) }
      print "OK|" heading "|" name "|" version "|" stamped "|" src
      next
    }
    END {
      if (heading != "" && have_marker == 0) {
        print "MALFORMED|" heading "|(missing marker)"
      }
    }
  ' "$file"
}

# detect_artifacts <scan-dir>
# Emits one line per detected technology, per the bounded catalog in
# ../reference/detection-artifacts.md:
#   <tech> <version> (evidence: <file>:<line>)
# Never fabricates a technology/version without file:line evidence — an ecosystem with no
# recognized artifact under <scan-dir> simply emits nothing.
detect_artifacts() {
  local scan_dir="$1"
  local lockfile="$scan_dir/package-lock.json"
  if [ -f "$lockfile" ]; then
    local line
    line="$(grep -n '"node":' "$lockfile" | head -1 || true)"
    if [ -n "$line" ]; then
      local lineno version
      lineno="${line%%:*}"
      version="$(printf '%s' "$line" | sed -E 's/.*"node": *"([^"]*)".*/\1/')"
      echo "node ${version} (evidence: package-lock.json:${lineno})"
    fi
  fi
  # Ruby: the `RUBY VERSION` stanza of Gemfile.lock pins the RUNTIME, which is the exact
  # analogue of package-lock.json's engines.node above. Per-gem/framework detection (rails,
  # rspec, ...) remains an explicit future extension — see ../reference/detection-artifacts.md,
  # "Extending this catalog". A Gemfile.lock with no `RUBY VERSION` stanza emits nothing:
  # absence of evidence is never a guessed default.
  local gemfile_lock="$scan_dir/Gemfile.lock"
  if [ -f "$gemfile_lock" ]; then
    local ruby_hit
    # `|| true`: an unreadable Gemfile.lock (e.g. permission denied) must not abort detection —
    # same tolerance as the Node branch's `grep ... || true` above.
    ruby_hit="$(awk '/^RUBY VERSION/ { if ((getline line) > 0) { sub(/\r$/, "", line); split(line, f, " "); if (f[1] == "ruby") { print NR "|" f[2] } } exit }' "$gemfile_lock" || true)"
    if [ -n "$ruby_hit" ]; then
      local ruby_lineno ruby_version
      ruby_lineno="${ruby_hit%%|*}"
      ruby_version="${ruby_hit##*|}"
      # Gemfile.lock records a patch level (`3.2.2p53`, or the negative-patch oddity
      # `3.4.0p-1`); the version proper is what gets compared against a recorded
      # stack-sync:tech version, so strip it. Anchored to a trailing `p<digits-or-minus>`
      # rather than a plain `%%p*` glob, which would also eat into a prerelease tag that
      # merely contains a literal "p" (e.g. `3.4.0.preview1`).
      if [[ "$ruby_version" =~ ^(.*)p[0-9-]+$ ]]; then
        ruby_version="${BASH_REMATCH[1]}"
      fi
      echo "ruby ${ruby_version} (evidence: Gemfile.lock:${ruby_lineno})"
    fi
  fi
  # Documented catalog extension point (go.sum, Cargo.lock, requirements.txt/poetry.lock,
  # composer.lock, CI files) — see ../reference/detection-artifacts.md. Not yet wired: no
  # test drives them.
  return 0
}

cmd_detect() {
  detect_artifacts "$1"
}

# days_since <YYYY-MM-DD>
# Prints the number of whole days between <date> and today. Returns 1 (no output) if <date>
# can't be parsed. Tries BSD date (-j -f, macOS/bash-3.2 target) first, then GNU date (-d) for
# portability.
days_since() {
  local d="$1"
  local now_epoch stamped_epoch
  now_epoch="$(date "+%s")"
  if stamped_epoch="$(date -j -f "%Y-%m-%d" "$d" "+%s" 2>/dev/null)"; then
    :
  elif stamped_epoch="$(date -d "$d" "+%s" 2>/dev/null)"; then
    :
  else
    return 1
  fi
  echo $(( (now_epoch - stamped_epoch) / 86400 ))
}

# cmd_report <scan-dir> <best-practices-file>
# Read-only drift report: unregistered detected tech, stale (>STALE_DAYS) stamps, and
# lockfile-vs-recorded version drift. Never exits non-zero — cheap enough to suggest casually.
# Malformed markers are NOT this mode's concern (see cmd_audit).
cmd_report() {
  local scan_dir="$1" bp_file="$2"
  local detected sections
  detected="$(detect_artifacts "$scan_dir")"
  sections="$(parse_sections "$bp_file")"

  if [ -n "$detected" ]; then
    local d tech registered
    while IFS= read -r d; do
      [ -z "$d" ] && continue
      tech="${d%% *}"
      registered="$(printf '%s\n' "$sections" | awk -F'|' -v t="$tech" '$1=="OK" && $3==t {f=1} END{print f+0}')"
      [ "$registered" = "1" ] || echo "UNREGISTERED: $d"
    done <<DETECTED
$detected
DETECTED
  fi

  local status heading name version stamped src
  while IFS='|' read -r status heading name version stamped src; do
    [ "$status" = "OK" ] || continue
    local age
    age="$(days_since "$stamped" 2>/dev/null || echo -1)"
    if [ "$age" -ge 0 ] && [ "$age" -gt "$STALE_DAYS" ]; then
      echo "STALE: $name stamped $stamped (${age} days ago)"
    fi
    local det_version
    det_version="$(printf '%s\n' "$detected" | awk -v t="$name" '$1==t {print $2}')"
    if [ -n "$det_version" ] && [ "$det_version" != "$version" ]; then
      echo "DRIFT: $name detected=$det_version recorded=$version"
    fi
  done <<SECTIONS
$sections
SECTIONS

  return 0
}

# is_valid_date <value>
# True only for a well-formed YYYY-MM-DD string that names a real calendar date. Tries BSD date
# (macOS/bash-3.2 target) first, then GNU date for portability.
is_valid_date() {
  local d="${1:-}"
  case "$d" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
    *) return 1 ;;
  esac
  if date -j -f "%Y-%m-%d" "$d" "+%Y-%m-%d" >/dev/null 2>&1; then
    return 0
  fi
  if date -d "$d" "+%Y-%m-%d" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# cmd_audit <scan-dir> <best-practices-file>
# HARD-FAIL (exit 1) ONLY on a missing or malformed stack-sync:tech marker — a structural defect
# (feeds qa_audit Check 9's hard-fail tier). Drift/staleness (from cmd_report) are printed as
# WARNING and never affect the exit code — the "not yet refreshed" case stays a warning, not a
# hard failure.
cmd_audit() {
  local scan_dir="$1" bp_file="$2"
  local hard_fail=0
  local sections
  sections="$(parse_sections "$bp_file")"

  local status heading name version stamped src bad
  while IFS='|' read -r status heading name version stamped src; do
    [ -z "$status" ] && continue
    if [ "$status" = "MALFORMED" ]; then
      echo "HARD-FAIL: missing stack-sync:tech marker for section '$heading' in $bp_file"
      hard_fail=1
      continue
    fi
    bad=""
    [ -z "$name" ] && bad="name"
    [ -z "$bad" ] && [ -z "$version" ] && bad="version"
    if [ -z "$bad" ] && ! is_valid_date "$stamped"; then
      bad="stamped"
    fi
    if [ -z "$bad" ]; then
      case " $VALID_SOURCES " in
        *" $src "*) ;;
        *) bad="source" ;;
      esac
    fi
    if [ -n "$bad" ]; then
      echo "HARD-FAIL: malformed stack-sync:tech marker ($bad) for section '$heading' in $bp_file"
      hard_fail=1
    fi
  done <<SECTIONS
$sections
SECTIONS

  local report
  report="$(cmd_report "$scan_dir" "$bp_file")"
  if [ -n "$report" ]; then
    local line
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      echo "WARNING: $line"
    done <<REPORT
$report
REPORT
  fi

  [ "$hard_fail" -eq 0 ]
}

main() {
  local mode="${1:-}"
  case "$mode" in
    --detect)
      [ $# -ge 2 ] || { usage; exit 2; }
      cmd_detect "$2"
      ;;
    --report)
      [ $# -ge 3 ] || { usage; exit 2; }
      cmd_report "$2" "$3"
      exit 0
      ;;
    --audit)
      [ $# -ge 3 ] || { usage; exit 2; }
      if cmd_audit "$2" "$3"; then
        exit 0
      else
        exit 1
      fi
      ;;
    *)
      usage
      exit 2
      ;;
  esac
}

main "$@"
