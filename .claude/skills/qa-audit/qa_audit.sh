#!/usr/bin/env bash
set -euo pipefail
# qa_audit.sh - Single audit entrypoint for .claude/skills/ (supersedes the old, always-green
# kaizen/scripts/validate_skill.sh, which is deleted).
#
# NOTE on `set -e` + a grep-heavy script: every `grep`/`diff` call whose "no match" (exit 1) is
# expected, normal signal — not an error — MUST be guarded with `|| true` (or live inside an
# if/while condition, which -e already exempts). Forgetting this guard on a pipeline is exactly
# what the postmortem below documents: -e + pipefail treats a clean grep miss as a command
# failure and kills the surrounding subshell mid-scan. Every `$(...)`/`<(...)` added to this file
# must be re-audited against that rule.
#
# Exit semantics (documented here per design decision, 2026-07-09 thermo-review consolidation):
#   - HARD FAILURES (exit 1 at end of run): forbidden AI mentions, no tracked files in scope,
#     unlabeled stack-command residue, stack.md/stack.template.md anchor-parity mismatch,
#     unresolved+unqualified `/skill-name` mentions, router/frontmatter tier mismatches,
#     session-artifact leaks (contract-ID/ticket-shaped tokens in the shipped payload), a DANGLING
#     or UNSHIPPED link (Check [links] — a target that does not exist, or exists but will not
#     ship). These are structural defects that always indicate a real bug.
#   - WARNINGS (printed, do not affect exit code): a PENDING link (Check [links] — an allowlisted
#     optional-forward reference to a file that may legitimately not exist yet), missing
#     coverage/forbidden-pattern doc cross-references, over-budget (>200 word) descriptions. Kept
#     as warnings because they can legitimately be "not yet built" (e.g. no coverage skill exists
#     yet in a fresh install) or a cosmetic smell (a long description), never a defect in what
#     does exist.
# The script runs every check and reports all findings before exiting, rather than bailing out
# on the first failure, so a single run gives the full picture.
#
# "What ships" is computed ONCE, below, as TRACKED_MD: every git-TRACKED *.md file under
# .claude/, templates/, investigations/ (via `git ls-files`, never the working tree). Check
# [residue] and Check [mentions] both iterate this same list instead of each defining their own
# scope, so the two can't drift apart. investigations/ is a gitignored per-ticket workspace
# except the checked-in investigations/_RPI-TEMPLATE.md, so a personal orchestration-log.md
# quoting these very patterns in a verification note (this file's own audit output, pasted into
# a ledger entry) is correctly invisible to the check — it never ships. This holds whether
# qa_audit.sh runs in dojo itself or in a project that installed it from templates/.
#
# DOJO_DEV_TREE, computed once below, answers "is this dojo's own repo, or a project that installed
# dojo?" from one marker: `templates/stack.template.md`. install.sh reads templates/ as a source but
# never copies the directory into a target, so that file exists only in dojo's own dev tree. A check
# gated on DOJO_DEV_TREE either widens its scope to dojo's own dev-only files (evals/, the repo-root
# install.sh) or SKIPs outright in a target, whose own scripts, tests and docs are project-owned,
# not dojo's shipped payload to police.
#
# Postmortem: this collector once ran its file walk under `set -euo pipefail`, piping `grep -nE
# PATTERN "$f" | sed ...` for every tracked file. `grep` exits 1 (not an error — "no match") on
# any file with zero mentions; with `pipefail` on, that 1 outranks `sed`'s trailing 0, so the
# pipeline itself reports failure, and under `-e` that killed the collector's subshell the
# instant it hit the first zero-mention file — silently dropping every file after it from the
# scan while still printing a false "OK: All slash-mentions resolve". That is the exact
# always-green disease this script exists to cure. Hence the `|| true` guard on the collector
# pipeline below AND the scanned-file self-assertion (mirroring the [scope] zero-file guard)
# that the scan actually visited at least one file before trusting an OK/FAIL verdict — neither
# guard is optional.
#
# Zero-file convention: an empty scope is never evidence of a clean tree. The run as a whole
# hard-fails ([scope]) only when git lists no tracked file at all under .claude/, templates/ or
# investigations/ (RAW_TRACKED, below). Past that, each check decides for itself: one that
# self-asserts its scope prints a FAIL instead of OK when it visited zero files (some only when
# files of that shape exist on disk), and one that does not can print OK over an empty scope. An
# OK line is therefore only as strong as its own check's self-assertion.

echo "=== QA Audit Starting ==="

HARD_FAIL=0

skillfile() { find ".claude/skills/$1" -maxdepth 1 -iname "skill.md" 2>/dev/null | head -1 || true; }

# ---------------------------------------------------------------------------
# TRACKED_MD — the single "what ships" computation (see header comment above).
# The [scope] guard tests RAW_TRACKED, not TRACKED_MD: an empty RAW_TRACKED means either
# `git ls-files` failed (not a git repo) or nothing under the scope was ever committed —
# both mean the audit can't see what ships, so this is a hard failure, never a silent OK. A
# RAW_TRACKED holding no *.md at all passes this guard and leaves TRACKED_MD empty.
# ---------------------------------------------------------------------------
RAW_TRACKED="$(git ls-files -- '.claude' 'templates' 'investigations' 2>/dev/null || true)"
if [ -z "$RAW_TRACKED" ]; then
  echo "FAIL: [scope] no tracked files under scope — is this a git repo with .claude committed?"
  HARD_FAIL=1
  TRACKED_MD=""
else
  TRACKED_MD="$(printf '%s\n' "$RAW_TRACKED" | while IFS= read -r f; do
    lc_f="$(printf '%s' "$f" | tr '[:upper:]' '[:lower:]')"
    case "$lc_f" in
      # Leading open-paren on the arm below: bash 3.2 case-inside-command-substitution
      # portability. See the long NOTE in check_links for the full mechanism.
      (*.md) [ -f "$f" ] && printf '%s\n' "$f" ;;
    esac
  done)"
fi

# DOJO_DEV_TREE — 1 in dojo's own dev tree, 0 in an installed target (see header comment above).
DOJO_DEV_TREE=0
[ -f templates/stack.template.md ] && DOJO_DEV_TREE=1

# TRACKED_SH — the shipped shell payload, shared by [fail-closed] and [repeatable-proof]: tracked
# `*.sh` under `.claude/` that exist on disk, never under a `tests/` directory (it never ships and
# holds known-bad fixtures on purpose), plus the tracked repo-root `install.sh` when DOJO_DEV_TREE=1
# (a target's own install.sh is project-owned). TRACKED_SH_DISK_COUNT counts `*.sh` on disk under
# `.claude/` (plus that install.sh), ignoring git, so a check can refuse OK when TRACKED_SH is empty
# while shell scripts exist.
TRACKED_SH="$(git ls-files -- '.claude' 2>/dev/null | grep -E '\.sh$' | grep -vE '(^|/)tests/' \
  | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done || true)"
TRACKED_SH_DISK_COUNT="$(find .claude -type f -name '*.sh' 2>/dev/null | wc -l | tr -d ' ' || true)"
if [ "$DOJO_DEV_TREE" -eq 1 ] && [ -f install.sh ]; then
  TRACKED_SH_DISK_COUNT=$((TRACKED_SH_DISK_COUNT + 1))
  if [ -n "$(git ls-files -- install.sh 2>/dev/null || true)" ]; then
    TRACKED_SH="${TRACKED_SH:+$TRACKED_SH
}install.sh"
  fi
fi

# ---------------------------------------------------------------------------
# Check [ai-mentions]: No Claude/AI mentions
# ---------------------------------------------------------------------------
check_ai_mentions() {
  echo "Checking for forbidden AI mentions..."
  if grep -rn "Co-Authored-By: Claude\|Generated with.*Claude" .claude/skills/ --include="*.md"; then
    echo "FAIL: [ai-mentions] Found AI mentions in skills"
    HARD_FAIL=1
  else
    echo "OK: [ai-mentions] No AI mentions"
  fi
}

# ---------------------------------------------------------------------------
# Check [residue]: Command residue — commands in skills must go through references to
# stack.md#commands, never hardcode a stack command. This is dojo's most important
# QA rule: a hardcoded stack command in a generalized skill is residue from the
# origin platform leaking into normative text.
#
# Scope: TRACKED_MD (computed once above) — every git-TRACKED *.md under .claude/,
# templates/, and investigations/, not just SKILL.md files, since residue can leak into
# reference/ docs, templates, and investigation artifacts too.
#
# The pattern below is dojo's own known-residue list (mirrors the "Residue grep" entry in
# .claude/skills/shared/stack.md#audit-checks, plus origin-machine path tokens). It is
# deliberately narrow: it catches terms that could only appear if origin-platform specifics
# leaked in, not every possible stack command in general (that would require knowing every
# stack this framework might ever run on). When adapting this script for an installed target
# project, point RESIDUE_PATTERN at that project's own documented stack-residue terms instead,
# if any exist.
#
# The trailing alternative `(^|[^A-Za-z0-9])(rails|rspec|activerecord|pbp)([^A-Za-z0-9]|$)`
# additionally catches these four tokens bare — i.e. not already covered by a more specific
# substring above (e.g. `pbp-platform`) — using a portable word-boundary idiom (mirrors
# `pattern_d` elsewhere in this file) so "Guardrails" is never a false hit. It is deliberately
# lowercase-only, not case-insensitive: genuine command/gem residue (`rails db:migrate`,
# `bundle exec rspec`, `pbp/…`, the `activerecord` gem) is always lowercase, while capitalized
# forms (`Rails`, `RSpec`) legitimately appear in prose/class-name references and inside labeled
# examples — a case-insensitive match would red-line those on day one (simulated against the
# real tree before landing this widening).
#
# A match is only a violation outside three EXPLICIT exemptions (no heuristics):
#   (a) a fenced code block labeled by a line containing "(Ruby/Rails example" on the fence's
#       own open line or on the line immediately before it — blank lines between the label and
#       the fence open are tolerated, but any other non-blank line in between abandons the
#       label. The label exempts its own line and the NEXT fence only — it never blanket-exempts
#       unrelated content later in the file,
#   (b) a file carrying a `<!-- residue-ok: file -->` marker anywhere in it — exempts the whole
#       file cover-to-cover (used by tdd/reference/assertion-quality.md and
#       architect/reference/examples.md, which are worked examples end to end), or
#   (c) a single line carrying an inline `<!-- residue-ok -->` marker — exempts that one line
#       (used by the residue-grep definition line in stack.md#audit-checks, which necessarily
#       quotes the pattern it detects).
# ---------------------------------------------------------------------------
check_residue() {
  echo "Checking for hardcoded stack-command residue..."
  local pattern='bin/d|facility|clickhouse|honeybadger|playbypoint|paybycourt|pronto|rubocop|simplecov|brakeman|packs/|pbp-platform|-Users-leon|workspace/pbp|(^|[^A-Za-z0-9])(rails|rspec|activerecord|pbp)([^A-Za-z0-9]|$)'

  local bad_residue
  bad_residue=$(printf '%s\n' "$TRACKED_MD" | while IFS= read -r f; do
    [ -z "$f" ] && continue
    # File-level exemption (b): skip the whole file without even opening the awk pass.
    grep -qF '<!-- residue-ok: file -->' "$f" && continue
    awk -v F="$f" -v PAT="$pattern" '
      {
        is_fence = ($0 ~ /^```/)
        if (is_fence) {
          if (in_fence == 0) {
            in_fence = 1
            if (pending || $0 ~ /\(Ruby\/Rails example/) { labeled = 1 } else { labeled = 0 }
            pending = 0
          } else {
            in_fence = 0
            labeled = 0
          }
          next
        }
        if ($0 ~ /\(Ruby\/Rails example/) { pending = 1; next }
        if ($0 ~ /<!-- residue-ok -->/) { next }
        if (labeled) { next }
        if (pending) {
          if ($0 ~ /^[ \t]*$/) { next }  # blank line before the fence — keep pending
          pending = 0
        }
        if ($0 ~ PAT) print F":"FNR": "$0
      }
    ' "$f"
  done)
  if [ -n "$bad_residue" ]; then
    echo "FAIL: [residue] Found unlabeled stack-command residue:"
    echo "$bad_residue"
    HARD_FAIL=1
  else
    echo "OK: [residue] No unlabeled stack-command residue"
  fi
}

# normalize_path DIR TARGET — resolves TARGET against DIR (normally dirname(<citing file>)),
# collapsing "." and ".." segments via pure string/array manipulation. NOT `realpath` — absent on
# stock macOS — and NOT dependent on the target existing on disk (a dangling target must still
# normalize to a comparable path string). Portable to bash 3.2: only indexed arrays (`declare -A`
# and `mapfile` are never used anywhere in this file).
#
# Shared by Check [links] below (to compare a resolved target against TRACKED_MD's canonical
# path strings) and, per design, the citation-cycle detector this normalizer was written for
# (edge-graph node identity needs the same canonical form).
normalize_path() {
  local dir="$1" target="$2" combined
  case "$target" in
    /*) combined="$target" ;;
    *) combined="$dir/$target" ;;
  esac
  # String accumulator, NOT an indexed array — deliberately. `segments=("${segments[@]}")` on an
  # array a preceding `unset` just emptied is an unbound-variable error under `set -u` on stock
  # macOS bash 3.2 (and on bash 4.0-4.3; fixed only in 4.4's `${arr[@]}` empty-array handling),
  # reachable from an ordinary citation whose `..` climb consumes the citing file's whole depth
  # (e.g. `../../../above-root.md`). A plain string plus `${result%/*}` needs no array-emptiness
  # special-casing at all: popping the last segment off an already-empty `result` is simply a
  # no-op, on every bash version.
  #
  # `overflow` counts ".." segments popped against an ALREADY-empty `result` — i.e. a climb that
  # goes above whatever root the citing file's own depth provides. Left uncounted, that pop would
  # be a silent no-op and the excess climb would simply vanish, so an over-climbing citation (more
  # ".." than the citing file has directory depth) could normalize to the exact same string as a
  # legitimate, in-repo path — and if a tracked file happened to sit at that string, the citation
  # would resolve as if it were followable, when no reader or tool could actually walk it (there is
  # no such directory above the repo root to climb through). `overflow` is applied as a residual
  # "../" prefix at the end instead, so the result can never collide with a real repo-relative path
  # in TRACKED_MD, and any lookup against it reports DANGLING (or, at worst, UNSHIPPED) rather than
  # a false OK.
  local result="" seg overflow=0
  local IFS='/'
  for seg in $combined; do
    case "$seg" in
      ""|".") continue ;;
      "..")
        case "$result" in
          */*) result="${result%/*}" ;;
          ?*) result="" ;;
          "") overflow=$((overflow + 1)) ;;
        esac
        ;;
      *)
        if [ -z "$result" ]; then
          result="$seg"
        else
          result="$result/$seg"
        fi
        ;;
    esac
  done
  if [ "$overflow" -gt 0 ]; then
    local prefix=""
    while [ "$overflow" -gt 0 ]; do
      prefix="../$prefix"
      overflow=$((overflow - 1))
    done
    result="$prefix$result"
  fi
  printf '%s\n' "$result"
}

# ---------------------------------------------------------------------------
# Check [links]: Citation resolution — every citation in a `.claude/skills/` or `.claude/agents/`
# file, in EITHER syntax (a bracketed markdown link, or a code span — the deliberate idiom for a
# path that may not exist yet, see tests/test_stack_sync_consumer_refs.sh), under any of the
# relative forms citation_pattern() collects (`(../)+<path>.md`, `.claude/<path>.md`, or a bare
# `reference/<path>.md`), must resolve to one of three outcomes:
#
#   DANGLING  — target does not exist and is not on LINK_PENDING_ALLOWLIST.        HARD_FAIL.
#   PENDING   — target does not exist but IS on LINK_PENDING_ALLOWLIST (a file that may
#               legitimately not exist yet in a fresh install).                    WARNING.
#   UNSHIPPED — target exists in the working tree but is not in TRACKED_MD, while the citing
#               file is — a shipped file citing a dependency that will not ship.   HARD_FAIL.
#
# Coverage invariant — this check is meaningless if it narrows on any of three independent axes,
# each capable of silently dropping a whole class of real citations while still printing OK:
#   1. Syntax  — both bracketed links AND code-span citations must be scanned; a code span is the
#      deliberate idiom for a path that may not exist yet (see tests/test_stack_sync_consumer_refs.sh)
#      and is the majority syntax among the real citations in this repo.
#   2. Directory — both .claude/skills/ and .claude/agents/ must be scanned.
#   3. Prefix — every relative form citation_pattern() defines must match, not just a literal
#      `](../shared/`; agents/*.md files write `../skills/shared/...`, a different prefix.
#
# The path-character classes below (`[A-Za-z0-9._/-]`) deliberately exclude `<`, `>`, and other
# punctuation, so a prose PLACEHOLDER path like `.claude/skills/<name>/SKILL.md` (illustrating a
# naming convention, not citing one specific file) never becomes a spurious DANGLING — a real path
# never contains those characters, so nothing this check is meant to catch is lost by excluding
# them.
#
# Scope: TRACKED_MD (computed once above), filtered to `.claude/skills/*.md` and
# `.claude/agents/*.md` — never a separate `find`/`grep -r` file list, so this check's scope can't
# drift from what the rest of the audit considers "what ships". Per the zero-file self-assertion
# convention (see header comment), an empty filtered scope is a hard failure naming the empty
# scope, never a silent OK — this is P1 (fail closed) applied to the collector itself.
# ---------------------------------------------------------------------------

# LINK_PENDING_ALLOWLIST — optional-forward targets that may legitimately not exist yet in a
# fresh install: `install.sh` never seeds them, only a specific downstream skill run creates them
# later. Matched by FULL canonical (normalize_path-resolved) repo-relative path, never by bare
# basename — a basename-only match would silently downgrade a genuinely dangling citation to the
# WRONG directory (e.g. `../../agents/typo-dir/best-practices.md`) to PENDING just because it
# happens to share a filename with the real allowlisted target. Extend deliberately, one full path
# + reason per line — this is a visible act, never a silent default (an allowlist entry that hides
# a genuine dangling/unshipped citation would be exactly the audit theater this check exists to
# end).
#   .claude/skills/shared/best-practices.md — created by `/stack-sync`; `install.sh` never seeds
#                        it, so any project that hasn't run `/stack-sync` yet legitimately cites a
#                        file that doesn't exist on disk, AND a project that has run `/stack-sync`
#                        but not yet committed the result legitimately cites one that exists but
#                        is untracked (see the PENDING-precedes-UNSHIPPED note on check_links below).
LINK_PENDING_ALLOWLIST=" .claude/skills/shared/best-practices.md "

# tracked_md_has PATH — pure-bash membership test for PATH against TRACKED_MD's newline-separated
# list of canonical repo-relative paths. NOT `printf '%s\n' "$TRACKED_MD" | grep -qxF "$PATH"`: once
# TRACKED_MD is large enough to exceed the OS pipe buffer, `grep -q` exits the instant it finds its
# match while `printf` is still writing later lines, `printf` takes SIGPIPE on its next write and
# returns 141, and `set -o pipefail` (this file runs under it) reports the WHOLE PIPELINE as failed
# even though grep genuinely matched — so a real, tracked target reads back as untracked, and the
# earlier it sorts in TRACKED_MD the more of the pipe is still unwritten when grep exits, making the
# false negative MORE likely for an early match, not less. A `case` pattern over the string is pure
# bash: no subprocess, no pipe, no race, and it stays correct at any TRACKED_MD size.
tracked_md_has() {
  local needle="$1"
  # Fail closed on either degenerate input: an empty needle can never be "tracked", and an empty
  # list tracks nothing — without this guard, the wrap below degenerates to matching "\n\n"
  # against itself when both are empty.
  if [ -z "$needle" ] || [ -z "$TRACKED_MD" ]; then
    return 1
  fi
  case $'\n'"$TRACKED_MD"$'\n' in
    *$'\n'"$needle"$'\n'*) return 0 ;;
  esac
  return 1
}

# citation_pattern — the single `grep -oE` regex matching a citation in EITHER syntax (a
# bracketed markdown link or a code span) under ANY of three relative forms — `(../)+<path>.md`,
# `.claude/<path>.md`, or a bare `reference/<path>.md` prefix (no leading ../ or .claude/) —
# optionally with a #anchor. The bare-`reference/` alternative is anchored on the left by the
# literal `](`/backtick immediately preceding "reference/", so it can never match a substring
# inside an unrelated word (e.g. "notreference/foo.md" does not end in "](" or a backtick right
# before "reference/").
#
# Shared by Check [links] and check_ref_cycles() below so the two collectors can never define
# "what counts as a citation" differently. If one recognised a citation form the other did not,
# the two checks would scan the same corpus under different scopes — a citation the link checker
# resolves could stay invisible to the cycle detector as an edge, letting a real citation cycle
# hide behind a green `OK: [ref-cycles]`.
citation_pattern() {
  local p
  p='\]\((\.\./)+[A-Za-z0-9._/-]+\.md(#[A-Za-z0-9_-]*)?\)'
  p="$p"'|\]\(\.claude/[A-Za-z0-9._/-]+\.md(#[A-Za-z0-9_-]*)?\)'
  p="$p"'|\]\(reference/[A-Za-z0-9._/-]+\.md(#[A-Za-z0-9_-]*)?\)'
  # shellcheck disable=SC2016 # backticks below are literal code-span delimiters in the regex,
  # not command substitution (same false positive already disabled elsewhere in this file).
  p="$p"'|`(\.\./)+[A-Za-z0-9._/-]+\.md(#[A-Za-z0-9_-]*)?`'
  # shellcheck disable=SC2016 # same literal-backtick false positive as the line above
  p="$p"'|`\.claude/[A-Za-z0-9._/-]+\.md(#[A-Za-z0-9_-]*)?`'
  # shellcheck disable=SC2016 # same literal-backtick false positive as the line above
  p="$p"'|`reference/[A-Za-z0-9._/-]+\.md(#[A-Za-z0-9_-]*)?`'
  printf '%s' "$p"
}

# strip_citation_syntax RAW — strips the syntax wrapper from a citation_pattern match (either
# `](...)`  or a code-span backtick pair) and returns the bare target (path plus optional
# #anchor — the anchor is NOT stripped here, callers strip it with `${target%%#*}`).
# Distinguished by the match's own first character. Shared by Check [links] and
# check_ref_cycles() below.
strip_citation_syntax() {
  local raw="$1" target
  if [ "${raw:0:1}" = '`' ]; then
    target="${raw:1}"
    target="${target%?}"
  else
    target="${raw:2}"
    target="${target%?}"
  fi
  printf '%s' "$target"
}

# citation_ok_lines FILE — prints the space-delimited, space-wrapped list of FILE's line numbers
# carrying an inline `<!-- citation-ok: <reason> -->` marker (e.g. " 39 40 "), for membership
# testing with a `case` glob. Empty (" ") when FILE carries none.
#
# Why this exemption exists at all: a document that quotes ANOTHER file verbatim has to reproduce
# that file's own citation string character-for-character — and that string is written relative to
# the QUOTED file's directory, so it does not resolve from the quoting file's directory. The
# citation is real, correct, and followable where it actually lives; it is simply not a live
# citation here. Without a marker the only ways to make such a line green are to re-path it (which
# turns a verbatim quotation into a misquote of the very text it claims to reproduce) or to strip
# its backticks (which destroys the formatting the quotation exists to reproduce) — i.e. damaging
# the document to satisfy the checker. That is the failure this marker prevents, and it is the
# same "the checker is right in general, wrong on this line" case `<!-- residue-ok -->` already
# solves for Check [residue].
#
# Deliberately LINE-scoped, with a MANDATORY non-empty reason, and with no file-level variant:
#   - line-scoped, so an unmarked dangling citation elsewhere in the same FILE is still reported —
#     a file-level marker (as [residue] has) would make one comment anywhere blanket-exempt the
#     whole document, which is precisely the blanket escape hatch this check must not grow.
#     But the exemption is granted to the whole LINE, not to one citation on it: a line carrying
#     the marker plus more than one citation exempts ALL of them, including one the author never
#     looked at. Author discipline (keep a marked line to a single citation) is what makes that
#     true in practice today — every live use is a single-citation table row — not the mechanism.
#   - reason mandatory (the regex requires at least one non-space character between `citation-ok:`
#     and ` -->`), so every use is a visible, justified act in the diff rather than a bare silencer.
# Consumed by BOTH Check [links] and collect_citation_edges() below: a line that is not a live
# citation must not become a live citation EDGE either, or the two collectors would disagree about
# what a citation is — the exact drift citation_pattern() exists to prevent.
citation_ok_lines() {
  local f="$1" out=" " n
  while IFS= read -r n; do
    [ -z "$n" ] && continue
    out="$out$n "
  done < <(grep -nE '<!-- citation-ok: [^>]*[^ >] -->' "$f" 2>/dev/null | cut -d: -f1 || true)
  printf '%s' "$out"
}

check_links() {
  echo "Checking for dangling/unshipped/pending citations..."

  local link_pattern
  link_pattern="$(citation_pattern)"

  # NOTE on the leading "(" on the case arm below: stock macOS /bin/bash 3.2 fails to parse a
  # bare `pattern)` case arm when the whole `case` statement is lexically nested inside a
  # `$(...)` command substitution — it misreads the arm's closing `)` as closing the
  # substitution itself ("syntax error near unexpected token `newline'"). Wrapping the pattern in
  # its own parens (`(pattern)`) is the standard portable fix. `bash -n` does NOT catch this class
  # of error (it only checks syntax under the interpreter running it, not the target version), so
  # any change to a `case` nested inside `$(...)` in this file must be re-verified by executing
  # under real `/bin/bash` 3.2 on macOS, not merely `bash -n`-checked.
  #
  # 3.2 finds the end of a substitution body by COUNTING parentheses, which has a second
  # consequence with the same blast radius: a comment inside such a body must keep its own parens
  # balanced too. A lone `(` in a comment is counted, and produces the mirror-image failure
  # "unexpected EOF while looking for matching `)`" — again killing the whole file, again invisible
  # to a modern `bash -n`. Write those comments paren-free.
  #
  # Every `case` nested inside a substitution in this file now carries the parenthesized form, and
  # tests/test_qa_audit_honesty.sh's test_parses_and_runs_under_bash_3_2 EXECUTES this script under
  # /bin/bash 3.2 (skipping, not passing, where no bash 3.x exists) so a regression is caught by
  # the suite rather than by a macOS user.
  local link_files
  link_files="$(printf '%s\n' "$TRACKED_MD" | while IFS= read -r f; do
    case "$f" in
      (.claude/skills/*.md|.claude/agents/*.md) printf '%s\n' "$f" ;;
    esac
  done)"

  local scanned_file_count
  scanned_file_count="$(printf '%s\n' "$link_files" | awk 'NF' | wc -l | tr -d ' ')"

  if [ "$scanned_file_count" -eq 0 ]; then
    echo "FAIL: [links] self-assertion failed — scanned zero files under .claude/skills/ or .claude/agents/ (empty scope, see header comment's zero-file convention)"
    HARD_FAIL=1
    return
  fi

  local dangling_count=0 pending_count=0 unshipped_count=0 citation_count=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    local dir exempt_lines
    dir="$(dirname "$f")"
    exempt_lines="$(citation_ok_lines "$f")"
    while IFS=: read -r lineno raw; do
      [ -z "${lineno:-}" ] && continue
      # Quotation exemption, applied BEFORE the citation is counted as examined: a marked line is
      # not a live citation, so it is neither resolved nor tallied (see citation_ok_lines above).
      case "$exempt_lines" in
        *" $lineno "*) continue ;;
      esac
      citation_count=$((citation_count + 1))
      local target path_part resolved
      target="$(strip_citation_syntax "$raw")"
      path_part="${target%%#*}"
      case "$path_part" in
        .claude/*) resolved="$(normalize_path "." "$path_part")" ;;
        *) resolved="$(normalize_path "$dir" "$path_part")" ;;
      esac
      # Allowlist decision FIRST, anchored on the full resolved path — before the
      # shipped/unshipped classification, not after it. An allowlisted target that exists on disk
      # but is untracked (exactly the state `/stack-sync` leaves best-practices.md in before it is
      # committed) must be PENDING at WARNING tier, never UNSHIPPED at HARD_FAIL: the allowlist
      # exists precisely to describe files that may legitimately be in a not-yet-shipped state,
      # whether "does not exist yet" or "exists but isn't tracked yet" — both are the same
      # "not shipped yet" condition from the allowlist's point of view.
      case "$LINK_PENDING_ALLOWLIST" in
        *" $resolved "*)
          if [ -f "$resolved" ] && tracked_md_has "$resolved"; then
            : # allowlisted target has, in fact, shipped — nothing to report
          else
            echo "  PENDING: $f:$lineno -> $path_part (optional-forward allowlist: $resolved)"
            pending_count=$((pending_count + 1))
          fi
          ;;
        *)
          if [ -f "$resolved" ]; then
            if ! tracked_md_has "$resolved"; then
              echo "  UNSHIPPED: $f:$lineno -> $path_part (exists at $resolved but is not a git-tracked/shipped file)"
              unshipped_count=$((unshipped_count + 1))
            fi
          else
            echo "  DANGLING: $f:$lineno -> $path_part"
            dangling_count=$((dangling_count + 1))
          fi
          ;;
      esac
    done < <(grep -noE "$link_pattern" "$f" 2>/dev/null || true)
  done < <(printf '%s\n' "$link_files")

  # Every verdict publishes citation_count, not just the file count. A [links] run that resolved
  # ZERO citations while scanning hundreds of files is what a neutered citation_pattern(), a broken
  # strip_citation_syntax(), or a silently truncated grep looks like from the outside — and without
  # the count in the line, that state is indistinguishable from a clean resolve of thousands. This
  # mirrors check_mentions' mention_line_count reporting, including its zero case: zero citations is
  # NOT a hard failure (a minimal install with no cross-references is legitimate), it is stated
  # explicitly so a reader can tell the two apart. tests/test_qa_audit_links.sh asserts this repo's
  # own tree reports a NON-ZERO count, which is where the fail-open regression would actually bite.
  if [ "$dangling_count" -gt 0 ] || [ "$unshipped_count" -gt 0 ]; then
    echo "FAIL: [links] $dangling_count dangling + $unshipped_count unshipped citation(s) found ($citation_count citation(s) examined across $scanned_file_count file(s) scanned)"
    HARD_FAIL=1
  elif [ "$pending_count" -gt 0 ]; then
    echo "WARNING: [links] $pending_count pending (optional-forward) citation(s) found ($citation_count citation(s) examined across $scanned_file_count file(s) scanned)"
  elif [ "$citation_count" -eq 0 ]; then
    echo "OK: [links] No dangling/unshipped citations (0 citation(s) examined — nothing to resolve; $scanned_file_count file(s) scanned)"
  else
    echo "OK: [links] No dangling/unshipped citations ($citation_count citation(s) examined across $scanned_file_count file(s) scanned)"
  fi
}

# ---------------------------------------------------------------------------
# Check [ref-cycles]: Citation-cycle detector — the reference graph over TRACKED_MD plus the
# repo-root CLAUDE.md must be acyclic. A cycle means neither document can be read in isolation:
# each defers to the other for the rule it is itself supposed to state, so a reader following
# citations never reaches ground truth.
#
# Edge collection reuses citation_pattern()/strip_citation_syntax(), normalize_path() and
# citation_ok_lines() (see Check [links] above), so the two collectors can never define "what
# counts as a citation" differently. Scope is the full TRACKED_MD list (not filtered to
# skills/agents like [links] — a cycle can run through any shipped doc) plus the repo-root
# CLAUDE.md, per spec. A file citing its own path is dropped at edge-collection time — it is not a
# dependency on anything else, and must never reach the detector as a self-loop.
#
# Invariant (not an algorithm): the detector reports a cycle if and only if the edge graph
# contains one, prints one concrete cycle when it does, and never depends on a fail-open utility
# for that verdict. It is pure awk, never `tsort`: `tsort` on macOS prints its cycle message to
# stderr and EXITS 0 on a cyclic input — a fail-open tool whose message wording differs BSD-vs-GNU,
# so neither its exit status nor its text is a safe signal in a script shipped to arbitrary
# machines.
#
# Breadcrumb exemption — dojo's standard progressive-disclosure shape is a SKILL.md that links
# DOWN into a detail document plus that document linking back UP to the SKILL.md that owns it.
# That pair is a 2-cycle in the raw graph but is NOT the defect this check exists to catch: the
# detail document is not deferring to SKILL.md for the rule it is itself supposed to state, it is
# naming its own parent so a reader who arrives sideways can find the entry point. So an edge is
# dropped when ALL THREE hold: its target is a `SKILL.md`, its source is NOT a `SKILL.md`, and the
# reverse edge (SKILL.md -> source) is present in the graph. The third condition rules out the
# narrowest hole — an edge to a SKILL.md that does NOT link back is an ordinary edge, and a cycle
# through it is still reported (tests/test_qa_audit_ref_cycles.sh proves both halves).
#
# Known limitation, stated rather than hidden: detection is file-granular, not edge-granular. Once
# the reverse edge exists — which it will for any ordinary downward link from a SKILL.md into a
# detail document, dojo's own encouraged progressive-disclosure shape — EVERY edge from that detail
# document back to that SKILL.md is dropped, breadcrumb or substantive alike. A genuine circular
# deferral (SKILL.md -> other.md -> detail.md -> SKILL.md, where detail.md really is deferring to
# SKILL.md for a rule it should state itself) is reported when no such downward link exists, but
# goes undetected the moment one does, because the checker cannot distinguish "this edge is the
# breadcrumb" from "this edge is a different, substantive citation that happens to close a cycle at
# the same two nodes." This is a latent limitation, not an active hole: on this repo's own tree
# exactly 3 of the edges collected are dropped by this exemption, and disabling the exemption
# entirely surfaces no cycle beyond each dropped edge's own intended trivial 2-cycle — i.e. zero
# masked cycles exist here today.
# ---------------------------------------------------------------------------

# collect_citation_edges SCOPE — prints one `<citing file>\t<resolved target>` edge per live
# citation found in SCOPE (a newline-separated file list), in file-scan order. Self-citations and
# `citation-ok`-marked lines are dropped here, so they never reach the detector. Stdout is the
# whole interface: no temp file, no global, no EXIT trap (an EXIT trap here would clobber any
# other EXIT trap the script or its caller has installed, to clean up a file that need not exist).
collect_citation_edges() {
  local scope="$1" pattern
  pattern="$(citation_pattern)"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    local dir exempt_lines
    dir="$(dirname "$f")"
    exempt_lines="$(citation_ok_lines "$f")"
    while IFS=: read -r lineno raw; do
      [ -z "${lineno:-}" ] && continue
      case "$exempt_lines" in
        *" $lineno "*) continue ;;
      esac
      local target path_part resolved
      target="$(strip_citation_syntax "$raw")"
      path_part="${target%%#*}"
      case "$path_part" in
        .claude/*) resolved="$(normalize_path "." "$path_part")" ;;
        *) resolved="$(normalize_path "$dir" "$path_part")" ;;
      esac
      [ "$resolved" = "$f" ] && continue
      printf '%s\t%s\n' "$f" "$resolved"
    done < <(grep -noE "$pattern" "$f" 2>/dev/null || true)
  done < <(printf '%s\n' "$scope")
}

check_ref_cycles() {
  echo "Checking for citation cycles..."

  local cycle_scope
  cycle_scope="$TRACKED_MD"
  if [ -f "CLAUDE.md" ]; then
    cycle_scope="$(printf '%s\n%s\n' "$cycle_scope" "CLAUDE.md")"
  fi

  local scanned_file_count
  scanned_file_count="$(printf '%s\n' "$cycle_scope" | awk 'NF' | wc -l | tr -d ' ')"
  if [ "$scanned_file_count" -eq 0 ]; then
    echo "FAIL: [ref-cycles] self-assertion failed — scanned zero files (empty scope, see header comment's zero-file convention)"
    HARD_FAIL=1
    return
  fi

  local edges edge_count
  edges="$(collect_citation_edges "$cycle_scope")"
  edge_count="$(printf '%s\n' "$edges" | awk 'NF' | wc -l | tr -d ' ')"

  local cycle_line
  cycle_line="$(printf '%s\n' "$edges" | awk -F'\t' '
    NF == 2 {
      ef[++m] = $1; et[m] = $2
      edge[$1 SUBSEP $2] = 1
      if (!(ef[m] in seen)) { seen[ef[m]] = 1; order[++ord_n] = ef[m] }
      if (!(et[m] in seen)) { seen[et[m]] = 1; order[++ord_n] = et[m] }
    }
    function base(p,   n, a) { n = split(p, a, "/"); return tolower(a[n]) }
    # See the breadcrumb-exemption paragraph in this check header for why all three conditions
    # are required.
    function is_breadcrumb(j) {
      return (base(et[j]) == "skill.md" && base(ef[j]) != "skill.md" && ((et[j] SUBSEP ef[j]) in edge))
    }
    function dfs(u,    j, k, out, cstart) {
      if (cycle_found) return
      if (in_path[u]) {
        for (k = 1; k <= path_len; k++) { if (path[k] == u) { cstart = k; break } }
        out = path[cstart]
        for (k = cstart + 1; k <= path_len; k++) out = out " -> " path[k]
        out = out " -> " u
        cycle_line = out
        cycle_found = 1
        return
      }
      if (visited[u]) return
      visited[u] = 1
      in_path[u] = 1
      path_len++; path[path_len] = u
      for (j = 1; j <= m; j++) {
        if (cycle_found) break
        if (ef[j] == u && !dropped[j]) dfs(et[j])
      }
      in_path[u] = 0
      path_len--
    }
    END {
      for (j = 1; j <= m; j++) if (is_breadcrumb(j)) dropped[j] = 1
      # A grey/black depth-first walk from every node finds a cycle iff one exists, whatever order
      # the nodes come in: in_path[] is the grey set (a hit is a back edge, i.e. a cycle) and
      # visited[] is the black set (already fully explored, so never re-walked). No preliminary
      # graph reduction is needed or performed.
      for (i = 1; i <= ord_n && !cycle_found; i++) dfs(order[i])
      if (cycle_found) print cycle_line
    }
  ')"

  if [ -n "$cycle_line" ]; then
    echo "  CYCLE: $cycle_line"
    # The depth-first walk above stops at the FIRST concrete cycle it finds and returns, so with
    # two or more disjoint cycles only one is ever reported here. The message below must never
    # state a count — this detector does not compute a total, only "at least one".
    echo "FAIL: [ref-cycles] citation cycle found (showing the first; more may exist)"
    HARD_FAIL=1
  elif [ "$edge_count" -eq 0 ]; then
    # "No cycles" over an EMPTY edge set is trivially true and says nothing about the corpus, so
    # the zero case is stated explicitly rather than folded into the ordinary OK — same
    # fail-open-visibility reasoning as check_links' citation_count (see its verdict block).
    echo "OK: [ref-cycles] no citation cycles (0 citation edge(s) collected — nothing to check; $scanned_file_count file(s) scanned)"
  else
    echo "OK: [ref-cycles] no citation cycles ($edge_count citation edge(s) across $scanned_file_count file(s) scanned)"
  fi
}

# ---------------------------------------------------------------------------
# Check [fail-closed]: Argument-dispatch `case` statements must refuse an unrecognized value, not
# silently accept it (P1). Deliberately narrow: the subject of the `case` must be an argument-shaped
# variable — a bare positional (`$1`, `${1}`, …) or one of the conventional argument-loop names
# (`$arg`, `$flag`, `$opt`, and their braced forms) — never a bare pattern over every `case`
# statement in the tree. A general scan would trip on ordinary internal-mode dispatch
# (`case "$mode" in`), which has nothing to do with parsing input from outside the program; a check
# that cries wolf on code that was never fail-open gets ignored. Line-oriented, assuming the
# conventional style already used throughout this repo: `case ... in` opens a line, each arm starts
# a line, and `esac` closes one — not a full shell parser, and does not claim to be. A one-liner
# (the whole `case ... in ... esac` on one physical line) is still recognized: it is evaluated
# inline, at that same line, rather than entering the multi-line block state at all.
#
# Detection, per matched `case` block: no catch-all-shaped arm at all is FAIL-OPEN (MISSING). A
# catch-all-shaped arm is one whose pattern, split on `|`, carries a bare `*` alternative (`*)`,
# `(*)` — the leading-paren idiom this very file uses elsewhere for bash 3.2 command-substitution
# portability — or `-h|*)`), OR the getopts invalid-option marker `\?)` — the getopts idiom for
# "no matching short option" on a `case` dispatching over `$opt`. A catch-all-shaped arm whose body
# never calls `exit`/`return` with a non-zero code is FAIL-OPEN (SILENT) UNLESS a separate `-*)`- or
# `--*)`-shaped arm (an "unrecognized flag" arm) already refuses in
# the same block — the shape `-*) ... exit 1 ;; *) TARGET="$arg" ;;` is fail-closed as a whole: the
# `-*)` arm already refuses every unrecognized flag, and the trailing `*)` arm exists only to accept
# a bare positional argument, not to re-validate one. "Refuses" tolerates a non-literal exit status
# (`exit "$E_USAGE"`, `exit ${CODE}`, quoted or not) and a propagated one (`exit $?`,
# `return $?`) as well as a literal non-zero one — only a literal `0` (or no argument at all) is
# accepted silently — and also tolerates a call to one of a short, explicit list
# of refusing helper functions (`usage`, `die`, `fail`, `abort`) in place of a bare `exit`/`return`,
# since a body that hands off to one of those names is refusing by convention even where this
# line-oriented scan cannot itself verify the callee's own exit code. Comments are stripped from an
# arm's body before any of the above tests run, so a comment merely mentioning `exit 1` is never
# mistaken for a real one; a `#` counts as a comment only where it starts a word (line start, or
# after whitespace or one of `;&|()`) outside single/double quotes, so `"bad arg #1"` and `${1#--}`
# survive the strip. The `*)` arm is assumed to be the last arm in the block — true of every
# conventionally-written case statement, since bash matches arms in order and anything declared
# after a catch-all would be dead code. Nested `case`/`esac` pairs inside the block (of any subject)
# are depth-counted so the scan finds the block's OWN closing `esac`, not an inner one's, and the
# `esac` token that starts a line closes a block whatever text follows it (`esac ;;`, `esac)"`,
# `esac || true`, a redirection) without breaking that count. A block that opens but is never
# closed by a matching `esac` before end of file is reported as UNTERMINATED rather than silently
# dropped.
#
# Known limitations (accepted; each is a false negative or false positive this scan does not try
# to resolve): an unquoted subject (`case $1 in`) is not matched at all; a string that merely
# contains `exit 1` (e.g. inside an `echo`) counts as refusing; a `-*)` arm placed AFTER the `*)`
# arm (dead code) still counts as refusing; the refusing-helper allowlist is fixed at
# `usage`/`die`/`fail`/`abort` and the callee is not verified; quote tracking for comment
# stripping resets at each physical line, so a quoted string spanning lines is not tracked; an
# `esac` that does not start its line (e.g. `*) x ;; esac` closing a multi-line block) is not seen
# as a close; the narrow "-*)"-shaped arm only recognizes a single dash prefix, so a `--*)`-only
# script with no bare `-*)` alternative refuses per-arm as designed, but a script whose only
# unrecognized-flag arm is single-dash-shaped and whose catch-all is the accepting kind is scored
# the same as any other narrow-arm-satisfies-block case — there is no separate coverage gap here,
# but a reader should not assume `-*)` and `--*)` are recognized identically beyond that one
# pairing; a refusing `exit`/`return` argument that is a variable or `$?` is trusted at face value
# — the scan has no way to know that variable's value, or the wrapped command's exit status, is
# actually non-zero at runtime, so a body that assigns 0 to that variable on every path still
# counts as refusing here; and a nested `case ... in` whose own `in` keyword is not the last token
# on its line is not recognized as opening a nested block by the depth counter (which matches
# `case ... in` only at end of line), so that inner block's arms are read as though they belonged
# to the outer block, and its own `esac` closes the outer block early instead of just itself.
#
# Scope: TRACKED_SH (defined near the top of this file). `templates/` is out of scope: it ships as
# TODO prompts for an installing project to fill in, never as executable payload.
# ---------------------------------------------------------------------------
check_fail_closed() {
  echo "Checking for fail-open argument dispatch..."

  local scope="$TRACKED_SH" scope_file_count
  scope_file_count="$(printf '%s\n' "$scope" | awk 'NF' | wc -l | tr -d ' ')"

  if [ "$scope_file_count" -eq 0 ] && [ "$TRACKED_SH_DISK_COUNT" -gt 0 ]; then
    echo "FAIL: [fail-closed] self-assertion failed — scanned zero shell scripts, but $TRACKED_SH_DISK_COUNT exist on disk under .claude/ (or install.sh, in dojo's own dev tree)"
    HARD_FAIL=1
    return
  fi

  local findings="" f result kind line_no
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    result="$(awk '
      # strip_comments TEXT drops the comment on each physical line: a "#" that starts a word (at line
      # start, or right after whitespace or one of the shell metacharacters ;&|()) while outside
      # any single- or double-quoted string. So a comment merely mentioning exit 1 is never
      # mistaken for a real one, while "bad arg #1" and ${1#--} are left intact. Quote state
      # resets at each physical line: a quoted string spanning lines is not tracked.
      function strip_comments(text,    n, i, j, l, c, prev, q, cut, out) {
        n = split(text, sc_lines, "\n")
        out = ""
        for (i = 1; i <= n; i++) {
          l = sc_lines[i]
          q = ""
          prev = " "
          cut = 0
          for (j = 1; j <= length(l); j++) {
            c = substr(l, j, 1)
            if (q == "\047") { if (c == "\047") q = "" }
            else if (c == "\\") { j++; c = "x" }
            else if (q == "\"") { if (c == "\"") q = "" }
            else if (c == "\047" || c == "\"") q = c
            else if (c == "#" && prev ~ /[ \t;&|()]/) { cut = j; break }
            prev = c
          }
          if (q != "") {
            # The flat, single-level tracker above cannot model a backslash-escaped closing
            # quote inside an ANSI C style dollar-quoted string, or nested double-quoting inside a
            # command substitution that opens its own quoting context — both leave it with an
            # unmatched open quote at end of line. Failing OPEN there (treating the rest of the
            # line, including a trailing comment, as still inside a string) would let a comment
            # naming a non-zero exit survive unstripped and be misread as a live refusal.
            # Fail SAFE instead: re-scan the line ignoring quote state entirely, falling back to
            # the pre-quote-aware behavior of cutting at the first word-start hash character.
            cut = 0
            prev = " "
            for (j = 1; j <= length(l); j++) {
              c = substr(l, j, 1)
              if (c == "#" && prev ~ /[ \t;&|()]/) { cut = j; break }
              prev = c
            }
          }
          if (cut > 0) l = substr(l, 1, cut - 1)
          out = out l "\n"
        }
        return out
      }

      # body_refuses BODY: a literal non-zero exit/return, a variable one (plain or braced,
      # optionally double-quoted), a propagated status ($?), or a call to one of a short,
      # explicit list of refusing helper functions, counts as refusing.
      function body_refuses(body,    stripped) {
        stripped = strip_comments(body)
        if (stripped ~ /(^|[^A-Za-z0-9_])(exit|return)[ \t]+"?[$]([A-Za-z_][A-Za-z0-9_]*|[{][A-Za-z_][A-Za-z0-9_]*[}]|[?])/) return 1
        if (stripped ~ /(^|[^A-Za-z0-9_])(exit|return)[ \t]+[1-9][0-9]*/) return 1
        if (stripped ~ /(^|\n|;)[ \t]*(usage|die|fail|abort)([ \t]|;|\n|$)/) return 1
        return 0
      }

      # pattern_class PAT classifies an arm pattern (the text between an optional leading "("
      # and its own closing ")", already stripped by the caller): "catchall" (carries a bare "*"
      # or the getopts invalid-option marker "\?" as one of its "|"-separated alternatives),
      # "narrow" (carries a bare "-*" or "--*" alternative — an "unrecognized flag" arm), or
      # "other".
      function pattern_class(pat,    p, wrapped) {
        p = pat
        sub(/^\(/, "", p)
        wrapped = "|" p "|"
        if (index(wrapped, "|*|") > 0) return "catchall"
        if (index(wrapped, "|\\?|") > 0) return "catchall"
        if (index(wrapped, "|-*|") > 0 || index(wrapped, "|--*|") > 0) return "narrow"
        return "other"
      }

      # evaluate_arms TEXT scans a case-block interior (every arm; arm boundaries are found by
      # re-splitting on ";;" first, so this works whether TEXT came from several real source
      # lines or a single physical one-liner) and returns "MISSING" (no catchall-shaped arm at
      # all), "SILENT" (a catchall-shaped arm exists but nothing in the block refuses), or ""
      # (fail-closed: either the catchall arm itself refuses, or a separate narrow "-*"-shaped
      # arm already refuses every unrecognized flag ahead of a catchall that only accepts a bare
      # positional argument).
      function evaluate_arms(text,    norm, n, i, l, lt, inner, lead_ws, lead_paren, is_open, arm_len, pat_only, found_catchall, catchall_ok, narrow_ok, started, curcls, curbody) {
        norm = text
        gsub(/;;/, ";;\n", norm)
        n = split(norm, ea_lines, "\n")
        started = 0
        curcls = ""
        curbody = ""
        found_catchall = 0
        catchall_ok = 0
        narrow_ok = 0
        for (i = 1; i <= n; i++) {
          l = ea_lines[i]
          lt = l
          sub(/^[ \t]*/, "", lt)
          lead_ws = length(l) - length(lt)
          lead_paren = 0
          inner = lt
          if (substr(lt, 1, 1) == "(") { inner = substr(lt, 2); lead_paren = 1 }
          is_open = 0
          arm_len = 0
          if (substr(inner, 1, 2) == "\\?" && substr(inner, 3, 1) == ")") {
            is_open = 1
            arm_len = lead_paren + 3
          } else if (match(inner, /^[A-Za-z0-9_.*?-]+(\|[A-Za-z0-9_.*?-]+)*\)/)) {
            is_open = 1
            arm_len = lead_paren + RLENGTH
          }
          if (is_open) {
            if (started) {
              if (curcls == "catchall") { found_catchall = 1; if (body_refuses(curbody)) catchall_ok = 1 }
              else if (curcls == "narrow") { if (body_refuses(curbody)) narrow_ok = 1 }
            }
            pat_only = substr(l, lead_ws + 1, arm_len - 1)
            curcls = pattern_class(pat_only)
            curbody = substr(l, lead_ws + arm_len + 1)
            started = 1
          } else if (started) {
            curbody = curbody "\n" l
          }
        }
        if (started) {
          if (curcls == "catchall") { found_catchall = 1; if (body_refuses(curbody)) catchall_ok = 1 }
          else if (curcls == "narrow") { if (body_refuses(curbody)) narrow_ok = 1 }
        }
        if (!found_catchall) return "MISSING"
        if (catchall_ok || narrow_ok) return ""
        return "SILENT"
      }

      function finalize(    verdict) {
        verdict = evaluate_arms(block_body)
        if (verdict != "") printf "%s\t%d\n", verdict, target_start
        in_target = 0
        target_depth = 0
        block_body = ""
      }

      {
        line = $0
        if (in_target == 0) {
          if (match(line, /case[ \t]+"\$\{?(arg|opt|flag|[0-9]+)\}?"[ \t]+in/)) {
            rest = substr(line, RSTART + RLENGTH)
            if (match(rest, /(^|[^A-Za-z0-9_])esac([^A-Za-z0-9_]|$)/)) {
              seg = substr(rest, RSTART, RLENGTH)
              esac_at = RSTART + (seg ~ /^esac/ ? 0 : 1)
              oneliner_verdict = evaluate_arms(substr(rest, 1, esac_at - 1))
              if (oneliner_verdict != "") printf "%s\t%d\n", oneliner_verdict, NR
              next
            }
            in_target = 1
            target_depth = 0
            block_body = ""
            target_start = NR
          }
          next
        }
        if (line ~ /^[ \t]*esac([^A-Za-z0-9_]|$)/) {
          if (target_depth > 0) { target_depth-- } else { finalize() }
          next
        }
        if (match(line, /case[ \t]+.*[ \t]in[ \t]*(#.*)?$/)) {
          target_depth++
          next
        }
        if (target_depth == 0) {
          block_body = (block_body == "" ? line : block_body "\n" line)
        }
      }
      END {
        if (in_target) printf "UNTERMINATED\t%d\n", target_start
      }
    ' "$f" || true)"
    [ -z "$result" ] && continue
    while IFS="$(printf '\t')" read -r kind line_no; do
      [ -z "$kind" ] && continue
      case "$kind" in
        MISSING)
          findings="$findings
  FAIL-OPEN: $f:$line_no argument dispatch has no catch-all arm"
          ;;
        SILENT)
          findings="$findings
  FAIL-OPEN: $f:$line_no argument dispatch's catch-all arm never refuses (no non-zero exit/return, no refusing helper call)"
          ;;
        UNTERMINATED)
          findings="$findings
  FAIL-OPEN: $f:$line_no argument dispatch case block is never closed by a matching esac (unterminated)"
          ;;
      esac
    done <<< "$result"
  done <<< "$(printf '%s\n' "$scope")"

  if [ -n "$findings" ]; then
    echo "$findings"
    echo "FAIL: [fail-closed] fail-open argument dispatch found (see FAIL-OPEN line(s) above)"
    HARD_FAIL=1
  else
    echo "OK: [fail-closed] no fail-open argument dispatch ($scope_file_count shell script(s) scanned)"
  fi
}

# ---------------------------------------------------------------------------
# Check [disclosure-slots]: P3 (disclosure) requires two things every agent's return format must
# carry: an item disclosing what remains UNCERTAIN, and — the absorbed Boy Scout Rule clause (ii)
# — an item disclosing what was OBSERVED but deliberately NOT acted on (out of scope for the
# current task). Nothing before this check prevented either item from being silently deleted from
# an agent file; it existed only as prose in whichever files happened to carry it.
#
# Assertions 1-2 are evadable text-grep pins on doctrine, like `check_principles_doc()`'s — a file
# could satisfy the letter by quoting the vocabulary without meaning it. Accepted for the same
# reason: the alternative is no pin at all, which is how `tdd/SKILL.md` regressed against practice
# in the first place.
#
# Assertions 3-4 are unrelated regression guards for the same principle in a different carrier
# (the RPI workflow's own disclosure bullets), grouped into this check because they are the other
# place P3 could be silently deleted from.
#
# Section scoping: a `## Return format` heading's own section ends at the NEXT `^## ` heading (or
# end of file) — never the rest of the file. Without this bound, uncertainty/non-action vocabulary
# living under a LATER, unrelated heading (e.g. a trailing `## Notes`) would satisfy assertions 1-2
# on the letter without the words ever having been part of the return format itself. Heading
# matching (both the entry check and the section-end check) is case-insensitive, so `## Return
# Format` is recognized the same as `## Return format`.
#
# SKIP vs OK: this check SKIPs — rather than reporting a bare OK — whenever there is nothing for
# assertions 1-2 to have actually evaluated: no `.claude/agents/*.md` at all, or agent files exist
# but none of them carry a `## Return format` heading in the first place. An OK in either case
# would overstate what this run verified.
# ---------------------------------------------------------------------------
check_disclosure_slots() {
  echo "Checking disclosure slots (P3)..."

  local agent_files
  agent_files="$(printf '%s\n' "$TRACKED_MD" | awk 'NF' | while IFS= read -r f; do
    case "$f" in
      # Leading open-paren on the arm below: bash 3.2 case-inside-command-substitution
      # portability. See the long NOTE in check_links for the full mechanism.
      (.claude/agents/*.md) [ -f "$f" ] && printf '%s\n' "$f" ;;
    esac
  done || true)"

  local agent_file_count
  agent_file_count="$(printf '%s\n' "$agent_files" | awk 'NF' | wc -l | tr -d ' ')"
  if [ "$agent_file_count" -eq 0 ] && [ -d ".claude/agents" ] \
    && [ -n "$(find .claude/agents -maxdepth 1 -type f -name '*.md' 2>/dev/null | head -1 || true)" ]; then
    echo "FAIL: [disclosure-slots] self-assertion failed — scanned zero .claude/agents/*.md files, but .claude/agents/ holds *.md on disk"
    HARD_FAIL=1
    return
  fi

  local findings="" f section sections_checked=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    grep -qiE '^## Return format' "$f" || continue
    sections_checked=$((sections_checked + 1))
    section="$(awk '
      {
        line = $0
        lc = tolower(line)
        is_heading = (lc ~ /^## /)
        is_target = (lc ~ /^## return format/)
        if (is_heading && !is_target) { found = 0 }
        if (is_target) { found = 1 }
        if (found) print line
      }
    ' "$f")"
    if ! printf '%s' "$section" | grep -qiE 'uncertain|open risk|open question|could not|did not verify|assumption'; then
      findings="$findings
  MISSING: $f return format has no uncertainty-disclosure item"
    fi
    if ! printf '%s' "$section" | grep -qiE 'out of scope|observed|did not act'; then
      findings="$findings
  MISSING: $f return format has no non-action-disclosure item"
    fi
  done <<< "$(printf '%s\n' "$agent_files")"

  # Assertion 3: the RPI template retains its residual-risk bullet (findings.md's own contract).
  if [ -f "investigations/_RPI-TEMPLATE.md" ] && ! grep -qiE 'residual risk' "investigations/_RPI-TEMPLATE.md"; then
    findings="$findings
  MISSING: investigations/_RPI-TEMPLATE.md has no residual-risk bullet"
  fi

  # Assertion 4: the investigation skill's findings.md exit bar retains both bullets — gracefully
  # absent (not checked) in a target that never installed the investigation skill.
  local inv_skill
  inv_skill="$(skillfile investigation)"
  if [ -n "$inv_skill" ]; then
    if ! grep -qiE 'what surprised you' "$inv_skill"; then
      findings="$findings
  MISSING: $inv_skill has no \"what surprised you\" bullet"
    fi
    if ! grep -qiE 'residual risk' "$inv_skill"; then
      findings="$findings
  MISSING: $inv_skill has no residual-risk bullet"
    fi
  fi

  if [ -n "$findings" ]; then
    echo "$findings"
    echo "FAIL: [disclosure-slots] disclosure slot(s) missing (see MISSING line(s) above)"
    HARD_FAIL=1
  elif [ "$agent_file_count" -eq 0 ]; then
    echo "SKIP: [disclosure-slots] no .claude/agents/*.md present"
  elif [ "$sections_checked" -eq 0 ]; then
    echo "SKIP: [disclosure-slots] no agent file carries a ## Return format section"
  else
    echo "OK: [disclosure-slots] all disclosure slots present ($agent_file_count agent file(s) scanned)"
  fi
}

# ---------------------------------------------------------------------------
# Check [repeatable-proof]: P6 (repeatable proof), generalizing the Programmer's Oath's "quick,
# sure, and repeatable proof that every element of the code works as it should" — every shipped
# executable payload SHALL be named by at least one test, so its proof survives the session that
# produced it rather than living only in a transcript.
#
# Scope: TRACKED_SH (defined near the top of this file) — never `tests/` itself, since a test naming
# ITSELF would trivially always pass.
#
# Dojo-dev-tree gate: SKIPs when DOJO_DEV_TREE=0 (see header comment) — a target's own tests/ never
# names dojo's installed scripts, so running there would report every one of them ORPHAN.
#
# Honesty note: on dojo's own tree, this check is currently a REGRESSION GUARD, not a defect
# finder — all five of dojo's tracked shell payloads are already named by a test. Its RED comes
# from a fixture.
# ---------------------------------------------------------------------------
check_repeatable_proof() {
  echo "Checking repeatable-proof coverage of shipped executables..."

  if [ "$DOJO_DEV_TREE" -ne 1 ]; then
    echo "SKIP: [repeatable-proof] dojo-dev-tree-only check — templates/stack.template.md is absent, so this is an installed target: its own tests/ (if any) is project-owned, not proof of dojo's shipped payload"
    return
  fi

  if [ ! -d "tests" ] || [ -z "$(find tests -maxdepth 1 -type f -name 'test_*.sh' 2>/dev/null | head -1 || true)" ]; then
    echo "SKIP: [repeatable-proof] no tests/test_*.sh shell suite present"
    return
  fi

  local scope="$TRACKED_SH" scope_file_count
  scope_file_count="$(printf '%s\n' "$scope" | awk 'NF' | wc -l | tr -d ' ')"

  if [ "$scope_file_count" -eq 0 ] && [ "$TRACKED_SH_DISK_COUNT" -gt 0 ]; then
    echo "FAIL: [repeatable-proof] self-assertion failed — scanned zero shell scripts, but $TRACKED_SH_DISK_COUNT exist on disk under .claude/ or install.sh"
    HARD_FAIL=1
    return
  fi

  local findings="" f base
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    base="$(basename "$f")"
    if ! grep -rlF -- "$base" tests/test_*.sh >/dev/null 2>&1; then
      findings="$findings
  ORPHAN: $f has no test naming it"
    fi
  done <<< "$(printf '%s\n' "$scope")"

  if [ -n "$findings" ]; then
    echo "$findings"
    echo "FAIL: [repeatable-proof] shipped script(s) with no repeatable proof (see ORPHAN line(s) above)"
    HARD_FAIL=1
  else
    echo "OK: [repeatable-proof] every shipped script is named by a test ($scope_file_count script(s) scanned)"
  fi
}

# ---------------------------------------------------------------------------
# Check [coverage-doc]: Coverage requirement documented and pointed at stack.md#coverage
# (skipped gracefully if the coverage skill doesn't exist yet in this project)
# ---------------------------------------------------------------------------
check_coverage_doc() {
  echo "Checking coverage requirement documentation..."
  local coverage_file
  coverage_file="$(skillfile coverage)"
  if [ -z "$coverage_file" ]; then
    echo "SKIP: [coverage-doc] no coverage skill present yet"
  elif grep -q "stack.md#coverage" "$coverage_file"; then
    echo "OK: [coverage-doc] coverage skill references stack.md#coverage"
  else
    echo "WARNING: [coverage-doc] coverage skill does not reference stack.md#coverage"
  fi
}

# ---------------------------------------------------------------------------
# Check [forbidden-doc]: Forbidden patterns documented in tdd
# (skipped gracefully if the tdd skill doesn't exist yet in this project)
# ---------------------------------------------------------------------------
check_forbidden_doc() {
  echo "Checking forbidden-pattern documentation..."
  local tdd_file
  tdd_file="$(skillfile tdd)"
  if [ -z "$tdd_file" ]; then
    echo "SKIP: [forbidden-doc] no tdd skill present yet"
  elif grep -q "forbidden-patterns.md" "$tdd_file"; then
    echo "OK: [forbidden-doc] tdd skill references shared/forbidden-patterns.md"
  else
    echo "WARNING: [forbidden-doc] tdd skill missing forbidden-pattern documentation reference"
  fi
}

# ---------------------------------------------------------------------------
# Check [anchors]: Anchor parity — templates/stack.template.md and .claude/skills/shared/stack.md
# must expose the identical set of `## ` anchors, in the same order, so that every
# `stack.md#anchor` reference in a skill resolves the same way whether a project has run
# install.sh yet or not.
#
# TARGET FALLBACK NOTE: unlike [tiers] below, this check has NO installed-target equivalent to fall
# back to. Anchor parity is inherently a two-file DIFF between the dev-time template
# (templates/stack.template.md) and dojo's own dogfooded stack.md — an installed target only
# ever receives ONE of those two files (its own copied/filled-in stack.md; templates/ never
# ships, see install.sh's `git ls-files` walk). There is nothing on the target side to diff
# against, so this is a dojo-only check by construction, not a gap to fill later: it SKIPs
# (never fails) whenever either file is absent, with an explicit note saying so rather than a
# silent-looking "SKIP: file not present".
# ---------------------------------------------------------------------------
check_anchors() {
  echo "Checking stack.md / stack.template.md anchor parity..."
  local template_stack="templates/stack.template.md"
  local shared_stack=".claude/skills/shared/stack.md"
  if [ ! -f "$template_stack" ] || [ ! -f "$shared_stack" ]; then
    echo "SKIP: [anchors] dojo-only check — $template_stack and $shared_stack only both exist in dojo's own dev tree; an installed target never receives templates/, so there is no target-side equivalent to fall back to (see comment above check_anchors)"
  else
    local template_headings shared_headings
    template_headings="$(grep -E '^## ' "$template_stack" || true)"
    shared_headings="$(grep -E '^## ' "$shared_stack" || true)"
    if [ "$template_headings" != "$shared_headings" ]; then
      echo "FAIL: [anchors] anchor mismatch between $template_stack and $shared_stack"
      diff <(printf '%s\n' "$template_headings") <(printf '%s\n' "$shared_headings") || true
      HARD_FAIL=1
    else
      echo "OK: [anchors] anchor parity"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Check [mentions]: Slash-mention resolution — every backtick-quoted `/skill-name` mention in
# any tracked .md under .claude/ or templates/ (via TRACKED_MD, computed once above — this
# surfaces mentions in templates/CLAUDE.project.md and orchestrate/reference/ too, not just
# SKILL.md + agents/*.md) must resolve one of three ways:
#   1. a real directory in .claude/skills/,
#   2. an `/opsx:` command,
#   3. a name in KNOWN_EXTERNAL_SKILLS — built-ins or origin-platform names that never have a
#      local .claude/skills/ directory to resolve against (one place to extend), or
#   4. a line qualified as conditional ("if present", "if one exists", "matching project
#      skill" — the project-router escape hatch for skills that may not exist in every
#      installed project; this is the ONLY inline qualifier phrase this check recognizes — it
#      has real semantics for installed targets, unlike a bare label).
#
# Extraction is intentionally strict — a mention must be FULLY enclosed in one backtick pair
# (opening backtick immediately before the slash, closing backtick immediately after the
# name) — so a backtick that closes an unrelated code span right before an unrelated "/word"
# (e.g. `` `understanding.md`/design ``) is never mistaken for a skill mention, and multi-segment
# file paths (which are never bare-enclosed like `/word`) don't match either.
#
# See the postmortem note in the file header for why the collector below carries
# `|| true` and why MENTION_LINE_COUNT is asserted non-zero before the verdict is trusted.
# ---------------------------------------------------------------------------
check_mentions() {
  echo "Checking slash-mention resolution..."
  local skill_dirs
  skill_dirs="$(find .claude/skills -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | sort -u)"
  # Built-ins / origin-platform skill names with no local .claude/skills/ directory — extend here.
  local known_external_skills="code-review comments"
  local unresolved_count=0
  local mention_line_count=0
  local scanned_file_count=0

  # shellcheck disable=SC2016 # backticks below are literal delimiters, not command substitution
  while IFS=: read -r file lineno line; do
    [ -z "${file:-}" ] && continue
    if [ "$file" = "__SCANNED__" ]; then
      scanned_file_count=$((scanned_file_count + 1))
      continue
    fi
    mention_line_count=$((mention_line_count + 1))
    local mentions
    mentions="$(printf '%s\n' "$line" | grep -oE '`/[a-z][a-z0-9:-]+`' || true)"
    [ -z "$mentions" ] && continue
    while IFS= read -r mention; do
      [ -z "$mention" ] && continue
      local name resolved d
      name="$(printf '%s' "$mention" | tr -d '`')"
      name="${name#/}"
      case "$name" in
        opsx:*) continue ;;
      esac
      resolved=0
      for d in $skill_dirs $known_external_skills; do
        if [ "$d" = "$name" ]; then
          resolved=1
          break
        fi
      done
      [ "$resolved" -eq 1 ] && continue
      case "$line" in
        *"if present"*|*"if one exists"*|*"matching project skill"*) continue ;;
      esac
      echo "  UNRESOLVED: $file:$lineno -> /$name"
      unresolved_count=$((unresolved_count + 1))
    done <<MENTIONS
$mentions
MENTIONS
  done < <(printf '%s\n' "$TRACKED_MD" | while IFS= read -r f; do
    case "$f" in
      # Leading open-paren on the arm below: required for stock macOS /bin/bash 3.2 to parse a
      # case that is lexically nested inside a command or process substitution at all — see the
      # long NOTE in check_links above. Without it, 3.2 stops parsing this WHOLE FILE.
      (.claude/*|templates/*)
        # Emit a marker for every candidate file BEFORE the grep, regardless of whether it
        # matches — this is what lets the self-assertion below tell "the collector visited
        # zero files" (truncation, HARD FAIL) apart from "it visited files but none of them
        # happened to mention a skill" (legitimate, OK).
        printf '__SCANNED__:%s:\n' "$f"
        grep -nE '`/[a-z][a-z0-9:-]+`' "$f" 2>/dev/null | sed "s#^#$f:#" || true
        ;;
    esac
  done)

  # Self-assertion: distinguish "the collector never actually
  # visited a file" (truncation — real bug, HARD FAIL) from "it visited files but none of them
  # happen to carry a `/skill` mention" (legitimate — e.g. a minimal fixture repo with no
  # cross-skill references at all). scanned_file_count (from the __SCANNED__ marker, emitted
  # per candidate file regardless of match) is the truncation guard; mention_line_count alone
  # is NOT — a corpus can legitimately scan files and find zero mention-bearing lines.
  if [ "$scanned_file_count" -eq 0 ]; then
    echo "FAIL: [mentions] self-assertion failed — scanned zero files; the collector may have truncated silently (see the postmortem note at the top of this file)"
    HARD_FAIL=1
  elif [ "$unresolved_count" -gt 0 ]; then
    echo "FAIL: [mentions] $unresolved_count unresolved+unqualified slash-mention(s) found"
    HARD_FAIL=1
  elif [ "$mention_line_count" -eq 0 ]; then
    echo "OK: [mentions] All slash-mentions resolve (0 mention lines — nothing to resolve; $scanned_file_count file(s) scanned)"
  else
    echo "OK: [mentions] All slash-mentions resolve ($mention_line_count mention-bearing line(s) scanned, $scanned_file_count file(s) total)"
  fi
}

# ---------------------------------------------------------------------------
# Check [artifacts]: Session-artifact guard — mechanical, HARD-FAIL tier by design. This exact
# class of defect (a contract ID, ticket ID, or investigation-slug token leaking out of an
# orchestration session into the shipped payload) has shipped 5 separate times past prose-only
# review (see `../shared/forbidden-patterns.md` "Session artifacts in committed code"), which is
# why this check blocks rather than warns.
#
# Scope: every git-TRACKED *.md or *.sh file under `.claude/` or `templates/` (the shipped
# payload) — computed locally rather than reusing TRACKED_MD above, because this check needs
# *.sh too (the leaks include shell scripts) and must explicitly exclude any `tests/` path (a
# fixture file exercising these exact patterns to test the rule is not itself a leak) as well as
# `investigations/` (excluded by construction — the `git ls-files` pathspec below never includes
# it, unlike TRACKED_MD's). Also excluded, by exact path: `shared/stack.md` and
# `shared/best-practices.md`, the two files whose content the installing project authors and whose
# dojo-side copy never ships (rationale at the case arm below).
#
# Widened scope — dojo's OWN dev-only tooling (evals/, tests/test_evals_*.sh): these directories
# never ship (install.sh's list_tracked()/copy_framework_dir walks only ever touch .claude/,
# templates/, investigations/_RPI-TEMPLATE.md), yet leaks of this exact shape have shipped INTO
# them on this repo's own feature branches — a leak the payload-only scope above is
# structurally blind to. Runs only when DOJO_DEV_TREE=1 (see header comment), so an installed
# target's own tests/ is never in scope. This is deliberately narrow even inside dojo's own tree — it scans all of evals/
# (same *.md/*.sh filter as above) plus ONLY `tests/test_evals_*.sh`, never all of tests/, because
# tests/test_qa_audit_*.sh intentionally embeds these exact patterns as known-bad fixtures to test
# THIS check (test_qa_audit_artifacts.sh, test_qa_audit_check11.sh, test_qa_audit_honesty.sh) —
# scanning them would be a false positive against the suite that proves this check works.
#
# Tracked vs. working tree — the two scopes list files DIFFERENTLY, on purpose:
#   - payload scope: tracked only (`git ls-files`). "What ships" is defined by install.sh's own
#     `git ls-files` walk, so an untracked payload file literally cannot ship, and a staged one is
#     already tracked by the time /commit runs this audit.
#   - dev scope: tracked AND untracked-but-not-ignored (`--cached --others --exclude-standard`).
#     Nothing here ships, so "what ships" is the wrong question; these files are born untracked and
#     stay untracked for the entire branch that builds them. Listing them tracked-only is what made
#     this check a FALSE GREEN on its first outing: `git ls-files -- evals` returned zero rows on
#     the very branch the widened scope was added to catch, so the scan visited nothing and still
#     printed the OK line advertising the widened scope. `--exclude-standard` keeps gitignored
#     build output (evals/results/) out of scope.
#
# Scope self-assertion — every declared scope must prove it actually saw files. If a scope's
# listing comes back EMPTY while files of that scope's own shape sit on disk, the listing mechanism
# is broken and the scan is blind; the check hard-fails instead of printing OK. An empty scope is
# never evidence of a clean tree. (Mirrors the [scope] zero-file guard at the top of this file —
# the disease this whole script exists to cure is a check that reports OK while scanning nothing.)
#
# Patterns (each shape has caused a real leak this check would have caught):
#   (a) parenthesized contract label, e.g. a literal `(` + `C` + digits + `)`.  [payload scope]
#   (b) contract-ID + process-noun collocation, case-insensitive: `C` + digits + a space + one of
#       POSTMORTEM/FALLBACK/contract/gate/verified.                              [payload scope]
#   (c) investigation-slug shaped token (ALL-CAPS words joined by hyphens, regex
#       `[A-Z]{4,}(-[A-Z]+)+`) or a classic ticket ID (`[A-Z]{2,}-[0-9]+`).      [both scopes]
#   (d) a BARE contract/task ID token (`C`/`T` + digits, standalone word) or a `tasks.md`
#       reference.                                                            [DEV SCOPE ONLY]
#
# (NOTE — like the (a)/(b) descriptions above, the paragraphs below spell their example shapes out
# in words instead of writing them literally. This file is itself inside the payload scope: a
# literal example here IS a match, and the check would hard-fail on its own documentation.)
#
# Why (d) is needed — (a) and (b) are not enough on their own. They only recognise a leak wearing
# one of two costumes: an ID alone inside parentheses, or an ID followed by one of five listed
# process nouns. Every other real shape walks straight past them: two IDs sharing one parenthesised
# label (a contract ID, comma, a task ID); a parenthetical whose closing paren is on the NEXT line,
# so the line-based (a) never sees it; an ID followed by a process noun that isn't on (b)'s
# five-word list; and a naked task ID followed by a colon. All four shipped, inside the very scope
# this check advertises. Pattern (d) matches the ID token itself rather than its costume.
#
# Why (d) is dev-scope-only. `.claude/` is where dojo TEACHES the contract-ID convention, so it
# must quote bare IDs in prose — orchestrate/examples.md's worked webhook example, agents/worker.md
# and agents/validator.md ("the dispatch lists testable assertions ..."), and forbidden-patterns.md
# (the doc DEFINING this rule, which necessarily quotes the shape it bans) all legitimately carry
# them. Firing (d) against the payload would hard-fail dojo's own documentation for documenting
# itself. evals/ and tests/test_evals_*.sh are the opposite: implementation code that teaches
# nothing and quotes nothing, where a bare contract/task ID or a tasks.md reference can only be
# orchestration bookkeeping that leaked out of a session. Same asymmetry as the scope gate above —
# dev tree, not payload.
#
# allowlist_tokens is a literal, exact-match allowlist of strings that are shaped like (c) but
# are confirmed non-leaks by inspection of dojo's own shipped tree — extend it ONLY with a new
# literal token + inline justification; never widen a PATTERN above to make a match disappear
# (that would silently reopen the hole for a real leak of the same shape). Current survivors:
#   YYYY-MM-DD            — universal date-placeholder convention across doc templates.
#   HARD-FAIL             — this script's own / stack_check.sh's severity-tier output vocabulary.
#   FAIL-OPEN             — this script's own Check [fail-closed] finding-tier output vocabulary.
#   SHARED-PREMISE        — a named bias concept in adversarial-review/SKILL.md prose.
#   CORE-XXX              — placeholder-shaped illustrative path in grill-me/SKILL.md.
#   CORE-715, CORE-624    — illustrative ticket IDs in brainstorm/grill-me's "Check Investigations
#                           Folder" Step 0 worked examples.
#   CORE-121              — illustrative ticket ID inside a "(Ruby/Rails example" labeled
#                           commit-message block (commit/SKILL.md, create-pr/SKILL.md).
#   CORE-901              — investigation/SKILL.md's "New ticket, clean start" worked example.
#   CORE-189              — learning/SKILL.md's transcript example of the mistake being taught
#                           against (a ticket ID that should never have been in a code comment).
#   PROJ-189              — orchestrate/SKILL.md's ticket-ID-extraction worked example.
#   PROJ-623              — forbidden-patterns.md's own worked example of a leaked ticket key
#                           (the doc that defines this very rule, necessarily quoting its shape).
#   PICKLETOWN-OPEN-TIME  — investigation/SKILL.md's own worked example of an ad-hoc-named
#                           investigation folder.
#   WEAKENED-PASS,        — literal outcome labels that dojo's own dev-only tooling (dev scope
#   WEAKENED-FAIL,          above) prints and then parses back to decide its exit code. Behavioural
#   WEAKENED-FLAKY,         output, not prose — renaming them changes what that tooling emits.
#   SPLIT-PASS,             Same story for dojo's dev-only judge-quorum's 2-1-disagreement labels.
#   SPLIT-FAIL
#   FENCE-AWARE           — tests/test_evals_cases.sh's own descriptive name for
#                           extract_bash_block's fence-tracking behavior, not a slug.
#   STRUCTURAL-PARITY     — tests/test_evals_gate_removal.sh's own name for the invariant it
#                           asserts (content may change, the path SET may not), not a slug.
# ---------------------------------------------------------------------------
check_artifacts() {
  echo "Checking for session-artifact leaks (contract IDs, ticket-shaped tokens)..."
  local pattern_a='\(C[0-9]+\)'
  local pattern_b='C[0-9]+ (POSTMORTEM|FALLBACK|contract|gate|verified)'
  local pattern_c='[A-Z]{4,}(-[A-Z]+)+|[A-Z]{2,}-[0-9]+'
  # (d) dev-scope only. The `[^A-Za-z0-9_.]` fences make the token STANDALONE, which is what keeps
  # the known false-positive traps quiet: `C1..Cn` (trailing `.`), `SC2016` (leading `S`), and
  # `Check 11` (no digit after the C).
  local pattern_d='(^|[^A-Za-z0-9_.])[CT][0-9]+([^A-Za-z0-9_.]|$)|tasks\.md'
  local allowlist_tokens=" YYYY-MM-DD HARD-FAIL FAIL-OPEN SHARED-PREMISE CORE-XXX CORE-715 CORE-624 CORE-121 CORE-901 CORE-189 PROJ-189 PROJ-623 PICKLETOWN-OPEN-TIME WEAKENED-PASS WEAKENED-FAIL WEAKENED-FLAKY SPLIT-PASS SPLIT-FAIL FENCE-AWARE STRUCTURAL-PARITY "

  # count_lines — non-blank line count of a newline-separated file list ("" => 0). awk never exits
  # non-zero on no-match, unlike `grep -c`, so this is safe under `set -e`.
  count_lines() { printf '%s\n' "$1" | awk 'NF' | wc -l | tr -d ' '; }
  # disk_has — does at least one file of the given shape exist on disk, regardless of git? This is
  # the INDEPENDENT truth the scope self-assertion cross-checks each git-based listing against.
  disk_has() { [ -n "$(find "$1" -type f \( -name '*.md' -o -name '*.sh' \) 2>/dev/null | head -n 1 || true)" ]; }
  # filter_md_sh SF — prints SF if it is a *.md or *.sh path that still exists on disk, else nothing.
  # The one file-shape filter shared by every `git ls-files` scope below (payload, dev_scope_evals,
  # dev_scope_tests) — each site still supplies its own pathspec/ls-files flags, only this shared
  # per-path predicate is unified.
  filter_md_sh() {
    local sf="$1"
    case "$sf" in
      *.md|*.sh) [ -f "$sf" ] && printf '%s\n' "$sf" ;;
    esac
  }

  local scope dev_scope="" scope_blind=""
  scope="$(git ls-files -- '.claude' 'templates' 2>/dev/null | while IFS= read -r sf; do
    [ -z "$sf" ] && continue
    case "$sf" in
      # Leading open-paren on the arms below: bash 3.2 case-inside-command-substitution
      # portability. See the long NOTE in check_links for the full mechanism.
      (*/tests/*|tests/*) continue ;;
      # Project-authored, never shipped: install.sh skips PROJECT_OWNED_STACK_PATH and
      # PROJECT_OWNED_BESTPRACTICES_PATH (stack.md is seeded from templates/stack.template.md,
      # best-practices.md is never seeded), so dojo's copy of either reaches no target. Scanning
      # them catches no payload leak and hard-fails a project for its own prose, e.g. a stack.md
      # citing its own contracts. Exact paths only: this narrows scope, never a pattern.
      # kaizen_log.md / creation_log.md are deliberately NOT here: PROJECT_OWNED_BASENAMES
      # preserves them on --update, but a fresh install delivers dojo's copy verbatim, so they are
      # payload. tests/test_qa_audit_artifacts.sh pins both sides.
      (.claude/skills/shared/stack.md|.claude/skills/shared/best-practices.md) continue ;;
    esac
    filter_md_sh "$sf"
  done || true)"

  if [ -d ".claude" ] && [ "$(count_lines "$scope")" -eq 0 ]; then
    scope_blind="$scope_blind
  .claude/ + templates/ (tracked payload) — matched 0 files, but .claude/ holds *.md/*.sh on disk"
  fi

  # Widened scope — dojo-dev-tree-only (DOJO_DEV_TREE, see header comment).
  local dev_scope_active=0
  if [ "$DOJO_DEV_TREE" -eq 1 ]; then
    dev_scope_active=1
    local dev_scope_evals dev_scope_tests
    dev_scope_evals="$(git ls-files --cached --others --exclude-standard -- 'evals' 2>/dev/null | while IFS= read -r sf; do
      [ -z "$sf" ] && continue
      filter_md_sh "$sf"
    done || true)"
    dev_scope_tests="$(git ls-files --cached --others --exclude-standard -- 'tests/test_evals_*.sh' 2>/dev/null | while IFS= read -r sf; do
      [ -z "$sf" ] && continue
      filter_md_sh "$sf"
    done || true)"

    # Each dev sub-scope is DECLARED only if files of its shape exist on disk (so a dojo checkout
    # with no evals/ at all — e.g. master — declares nothing and is not penalised). A declared
    # scope that lists 0 files means the scan is blind to it.
    if disk_has "evals" && [ "$(count_lines "$dev_scope_evals")" -eq 0 ]; then
      scope_blind="$scope_blind
  evals/ (dojo dev tree) — matched 0 files, but evals/ holds *.md/*.sh on disk (gitignored? unreadable?)"
    fi
    if [ -n "$(find tests -maxdepth 1 -type f -name 'test_evals_*.sh' 2>/dev/null | head -n 1 || true)" ] &&
       [ "$(count_lines "$dev_scope_tests")" -eq 0 ]; then
      scope_blind="$scope_blind
  tests/test_evals_*.sh (dojo dev tree) — matched 0 files, but such files exist on disk"
    fi

    dev_scope="$(printf '%s\n%s\n' "$dev_scope_evals" "$dev_scope_tests" | awk 'NF')"
  fi

  # A blind scope is a HARD failure on its own — never fall through to an OK that would advertise
  # coverage this run did not deliver.
  if [ -n "$scope_blind" ]; then
    echo "FAIL: [artifacts] Declared scope(s) scanned NOTHING — refusing to report OK:"
    echo "$scope_blind"
    HARD_FAIL=1
  fi

  local scanned_count
  scanned_count="$(( $(count_lines "$scope") + $(count_lines "$dev_scope") ))"

  local bad_artifacts=""

  # scan_slug — pattern (c), run against BOTH scopes.
  scan_slug() {
    local f="$1"
    while IFS=: read -r lineno match; do
      [ -z "${lineno:-}" ] && continue
      case "$allowlist_tokens" in
        *" $match "*) continue ;;
      esac
      bad_artifacts="$bad_artifacts
$f:$lineno: investigation-slug/ticket token — $match"
    done < <(grep -noE "$pattern_c" "$f" 2>/dev/null || true)
  }

  # Payload scope: patterns (a) + (b) + (c). NOT (d) — see the (d) rationale above.
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    while IFS=: read -r lineno match; do
      [ -z "${lineno:-}" ] && continue
      bad_artifacts="$bad_artifacts
$f:$lineno: parenthesized contract label — $match"
    done < <(grep -noE "$pattern_a" "$f" 2>/dev/null || true)
    while IFS=: read -r lineno match; do
      [ -z "${lineno:-}" ] && continue
      bad_artifacts="$bad_artifacts
$f:$lineno: contract-ID + process-noun — $match"
    done < <(grep -inoE "$pattern_b" "$f" 2>/dev/null || true)
    scan_slug "$f"
  done < <(printf '%s\n' "$scope")

  # Dev scope: patterns (d) + (c). (d) strictly subsumes (a) and (b) — a parenthesised ID and an
  # ID-plus-process-noun are both standalone ID tokens too — so running (a)/(b) over these files
  # as well would only double-report the same line.
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    while IFS=: read -r lineno match; do
      [ -z "${lineno:-}" ] && continue
      bad_artifacts="$bad_artifacts
$f:$lineno: contract/task ID or tasks.md reference — $(printf '%s' "$match" | sed 's/^[^A-Za-z0-9]*//; s/[^A-Za-z0-9.]*$//')"
    done < <(grep -noE "$pattern_d" "$f" 2>/dev/null || true)
    scan_slug "$f"
  done < <(printf '%s\n' "$dev_scope")

  if [ -n "$bad_artifacts" ]; then
    echo "FAIL: [artifacts] Found session-artifact leak(s):"
    echo "$bad_artifacts"
    HARD_FAIL=1
  elif [ -n "$scope_blind" ]; then
    : # already hard-failed above — a blind scan must never print OK
  elif [ "$dev_scope_active" -eq 1 ]; then
    echo "OK: [artifacts] No session-artifact leaks ($scanned_count file(s) scanned — .claude/, templates/, plus dojo-dev-tree evals/ + tests/test_evals_*.sh)"
  else
    echo "OK: [artifacts] No session-artifact leaks ($scanned_count file(s) scanned)"
  fi
}

# ---------------------------------------------------------------------------
# Check [tiers]: Tier <-> frontmatter agreement — every skill named in one of the three router
# tiers ("### 1. Auto-invoke", "### 2. Confirm-first", "### 3. Manual-only") must have a
# `disable-model-invocation` frontmatter key in its own SKILL.md that agrees with its tier:
# tier 1 = auto-invoke = false, tier 2/3 = human-gated = true. Hard-fails on:
#   - true-in-tier-1:    listed in tier 1 but frontmatter says true,
#   - false-in-tier-2/3: listed in tier 2 or 3 but frontmatter says false,
#   - absent-from-all:   the skill has no `disable-model-invocation` key at all, or
#   - present-in-two:    the skill name is listed in more than one router tier.
#
# Root-router parity (dojo dev tree only): when templates/CLAUDE.project.md is present, it is
# also the reference for the live root ./CLAUDE.md router — the file dojo dogfoods against
# itself. The frontmatter cross-check above cannot catch a skill that is simply missing from a
# router (an absent skill is never cross-checked), which is exactly the drift class this closes.
# So, additionally: extract the root CLAUDE.md `dojo:router` marker block's own (tier, skill) set
# (same tier-extraction logic, reused via extract_tier_mentions) and `diff` it against the
# template's. Any difference — missing, extra, or moved-tier skill — or an absent marker block,
# is a hard fail printing the diff. This only runs when the template is present; it never affects
# an installed target (which has no templates/ to compare against).
#
# TARGET FALLBACK: the primary source is templates/CLAUDE.project.md (dojo's own dev-time
# template). That file never ships to an installed target (install.sh's `git ls-files` walk
# only copies .claude/ + a rendered CLAUDE.md; templates/ stays behind in dojo's own repo) — so
# on an installed target this check used to SKIP forever, exactly the kind of rot a fallback is
# meant to close. Fallback: when templates/CLAUDE.project.md is absent, parse the SAME tier tables out
# of the target's own ./CLAUDE.md, from inside the `<!-- dojo:router:start -->` /
# `<!-- dojo:router:end -->` marker block that install.sh seeds and re-syncs on every --update
# (see install.sh's extract_router — this reuses the identical marker pair, so the two stay in
# lockstep by construction).
# ---------------------------------------------------------------------------

# extract_tier_mentions — reads router markdown on stdin, prints "TIER NAME" pairs (sorted,
# deduped) for every `/skill-name` mention found under a "### N. <label>" tier heading. Shared by
# check_tiers for both the primary router source and the root-router parity comparison below, so
# the two never drift apart into two different parsers.
extract_tier_mentions() {
  awk '
    /^### 1\. Auto-invoke/ { tier=1; next }
    /^### 2\. Confirm-first/ { tier=2; next }
    /^### 3\. Manual-only/ { tier=3; next }
    /^### / { tier=0; next }
    /^## / { tier=0; next }
    {
      if (!tier) next
      line = $0
      while (match(line, /`\/[a-z][a-z0-9:-]+`/)) {
        m = substr(line, RSTART + 2, RLENGTH - 3)
        if (m !~ /^opsx:/) print tier" "m
        line = substr(line, RSTART + RLENGTH)
      }
    }
  ' | sort -u
}

check_tiers() {
  echo "Checking router tier <-> frontmatter agreement..."
  local router_file="templates/CLAUDE.project.md"
  local router_content=""
  local template_present=0
  if [ -f "$router_file" ]; then
    router_content="$(cat "$router_file")"
    template_present=1
  elif [ -f "CLAUDE.md" ] && grep -qF '<!-- dojo:router:start -->' CLAUDE.md && grep -qF '<!-- dojo:router:end -->' CLAUDE.md; then
    router_file="CLAUDE.md (dojo:router marker block)"
    router_content="$(awk '/<!-- dojo:router:start -->/{f=1;next} /<!-- dojo:router:end -->/{f=0} f' CLAUDE.md)"
  else
    echo "SKIP: [tiers] neither templates/CLAUDE.project.md nor a dojo:router marker block in ./CLAUDE.md is present"
    return
  fi

  local tier_fail_count=0
  local tier_mentions
  tier_mentions="$(printf '%s\n' "$router_content" | extract_tier_mentions)"

  local dup_names dup_names_sp
  dup_names="$(printf '%s\n' "$tier_mentions" | awk '{print $2}' | sort | uniq -d)"
  dup_names_sp=" $(printf '%s\n' "$dup_names" | tr '\n' ' ')"

  if [ -n "$dup_names" ]; then
    while IFS= read -r name; do
      [ -z "$name" ] && continue
      local tiers
      tiers="$(printf '%s\n' "$tier_mentions" | awk -v n="$name" '$2==n{print $1}' | tr '\n' ',' | sed 's/,$//')"
      echo "  FAIL: /$name is listed in more than one router tier ($tiers) — present-in-two"
      tier_fail_count=$((tier_fail_count + 1))
    done <<DUPS
$dup_names
DUPS
  fi

  while IFS=' ' read -r tier name; do
    [ -z "${tier:-}" ] && continue
    case "$dup_names_sp" in *" $name "*) continue ;; esac  # already reported above
    local file val
    file="$(skillfile "$name")"
    if [ -z "$file" ]; then
      continue  # router mentions a name with no local skill dir — nothing to cross-check
    fi
    # || true: same -e/pipefail hazard as the postmortem above — a skill legitimately
    # missing the frontmatter key (the "absent-from-all" case two lines below) makes grep exit
    # 1 with zero matches; without the guard that would kill the scan before ever reporting it.
    # This path was previously dead in practice because [tiers] always SKIPped in installed
    # targets (no templates/CLAUDE.project.md); the fallback below makes it live there now.
    val="$(grep -m1 '^disable-model-invocation:' "$file" | awk '{print $2}' || true)"
    if [ -z "$val" ]; then
      echo "  FAIL: /$name SKILL.md has no disable-model-invocation frontmatter key — absent-from-all"
      tier_fail_count=$((tier_fail_count + 1))
      continue
    fi
    case "$tier" in
      1)
        if [ "$val" = "true" ]; then
          echo "  FAIL: /$name is in router tier 1 (auto-invoke) but disable-model-invocation: true — true-in-tier-1"
          tier_fail_count=$((tier_fail_count + 1))
        fi
        ;;
      2|3)
        if [ "$val" = "false" ]; then
          echo "  FAIL: /$name is in router tier $tier but disable-model-invocation: false — false-in-tier-2/3"
          tier_fail_count=$((tier_fail_count + 1))
        fi
        ;;
    esac
  done <<MENTIONS
$tier_mentions
MENTIONS

  # Root-router parity (dojo dev tree only, see header comment above): only when the template is
  # the primary source, cross-check the live root ./CLAUDE.md router against it.
  if [ "$template_present" -eq 1 ]; then
    if [ -f "CLAUDE.md" ] && grep -qF '<!-- dojo:router:start -->' CLAUDE.md && grep -qF '<!-- dojo:router:end -->' CLAUDE.md; then
      local root_router_content root_tier_mentions parity_diff
      root_router_content="$(awk '/<!-- dojo:router:start -->/{f=1;next} /<!-- dojo:router:end -->/{f=0} f' CLAUDE.md)"
      root_tier_mentions="$(printf '%s\n' "$root_router_content" | extract_tier_mentions)"
      parity_diff="$(diff <(printf '%s\n' "$tier_mentions") <(printf '%s\n' "$root_tier_mentions") || true)"
      if [ -n "$parity_diff" ]; then
        echo "  FAIL: root CLAUDE.md dojo:router marker block's (tier, skill) set differs from $router_file — root-router-parity"
        while IFS= read -r diff_line; do
          echo "    $diff_line"
        done <<< "$parity_diff"
        tier_fail_count=$((tier_fail_count + 1))
      fi
    else
      echo "  FAIL: root CLAUDE.md has no dojo:router marker block to compare against $router_file — root-router-parity"
      tier_fail_count=$((tier_fail_count + 1))
    fi
  fi

  if [ "$tier_fail_count" -gt 0 ]; then
    echo "FAIL: [tiers] $tier_fail_count router tier / frontmatter mismatch(es) found (source: $router_file)"
    HARD_FAIL=1
  else
    echo "OK: [tiers] router tiers agree with SKILL.md frontmatter (source: $router_file)"
  fi
}

# ---------------------------------------------------------------------------
# Check [bestpractices]: best-practices.md structural audit — shells out to
# .claude/skills/stack-sync/scripts/stack_check.sh --audit, the single source of truth for the
# stack-sync:tech marker parse rules (structural audit of best-practices.md via stack_check.sh
# --audit; schema in .claude/skills/stack-sync/reference/best-practices-schema.md).
# SKIP conditions (graceful, mirroring [coverage-doc]/[forbidden-doc]/[anchors]):
#   - stack_check.sh absent → stack-sync isn't installed in this project
#   - .claude/skills/shared/best-practices.md absent → not yet generated
# Else: stack_check.sh --audit exits 1 ONLY on a missing/malformed stack-sync:tech marker — a
# structural defect, mapped to HARD_FAIL here. Drift/staleness WARNING lines the script itself
# prints are passed through as-is and never affect this check's outcome (same tiering as the
# script: valid stamp = hard, freshness/registration = warning).
# ---------------------------------------------------------------------------
check_bestpractices() {
  echo "Checking best-practices.md structural audit (stack-sync)..."
  local stack_check_script=".claude/skills/stack-sync/scripts/stack_check.sh"
  local best_practices_file=".claude/skills/shared/best-practices.md"
  if [ ! -f "$stack_check_script" ]; then
    echo "SKIP: [bestpractices] stack-sync not installed"
  elif [ ! -f "$best_practices_file" ]; then
    echo "SKIP: [bestpractices] no best-practices.md"
  else
    local bp_output bp_exit
    if bp_output="$(bash "$stack_check_script" --audit . "$best_practices_file" 2>&1)"; then
      bp_exit=0
    else
      bp_exit=1
    fi
    [ -n "$bp_output" ] && echo "$bp_output"
    if [ "$bp_exit" -ne 0 ]; then
      echo "FAIL: [bestpractices] best-practices.md failed structural audit (see HARD-FAIL line(s) above)"
      HARD_FAIL=1
    else
      echo "OK: [bestpractices] best-practices.md structural audit passed"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Check [duplicate-blocks]: One canonical home per rule (P5) — the same normative text must not
# live in more than one tracked file. A copy drifts the moment one instance is edited and the other
# is not; the 20-file Config Priority / TODO-fallback duplication this check was built to catch was
# previously certified in sync by check_fallback_line(), an audit that WAS a 21st copy of the string
# it audited rather than a fix.
#
# Method, in two steps.
#   1. Normalize every TRACKED_MD file into BLOCKS. A prose block is a paragraph: a maximal run of
#      non-blank lines, after stripping leading blockquote `>` markers, joined with single spaces
#      and whitespace-collapsed — so the same text hard-wrapped at a different column, or quoted
#      in one file and plain in another, normalizes identically. A paragraph also ends where the
#      blockquote depth changes, and a list item (`-`, `*`, `+`, `1.`, `1)` — marker stripped)
#      starts a new block of its own, as markdown renders them. Headings and table rows are
#      single-line blocks that never join neighboring text. Fenced code (``` or ~~~) and YAML
#      frontmatter are compared one LINE at a time and never joined: code and metadata are not
#      prose, and joining them would turn every shared snippet of short lines into a false block.
#   2. Compare every run of 25 consecutive words (a window) inside each block. Any window that
#      occurs in TWO OR MORE DISTINCT files is a duplication. Windows, not whole-block equality,
#      because the defect this check exists for did not respect paragraph boundaries: the old
#      per-skill header joined the (varying) Config Priority sentence and the (identical)
#      TODO-fallback sentence into one paragraph, so whole-paragraph equality found only the
#      largest identical-paragraph cluster, never all 20 copies of the shared sentence.
#
# Below ~20 words, table cells and short shared bullet phrasings collide (false positives); above
# ~40, only the block this check exists to catch would survive. 25 is a judgment call, pinned by
# tests/test_qa_audit_duplicate_blocks.sh's 24-word (OK) / 25-word (DUPLICATE) fixtures.
# Repetition within a SINGLE file does not count — the failure mode is two canonical homes, not a
# file quoting itself.
#
# One awk process reads the file list on stdin and opens each path itself with getline — no
# `xargs`: xargs word-splits on whitespace and quotes (a tracked `My Notes.md` or `don't.md`
# aborted the whole audit under `set -euo pipefail`), and it splits a long list across several awk
# invocations, which would hide a duplication whose copies landed in different batches. Nor one
# fork per file: this check's scope is every tracked .md, and a per-file fork loop on top of every
# other check's is what made bash 3.2 crash on tests/test_qa_audit_links.sh's large-tree fixture.
# A path awk cannot open is reported as UNREADABLE and fails the check rather than being skipped,
# and awk's own stderr is left visible.
#
# Tier: HARD_FAIL, deliberately with NO allowlist. An allowlist entry for a pre-existing
# duplication would just be check_fallback_line() again — the exact audit-certifies-the-duplication
# theater P5 exists to end. This check ships together with whatever centralization makes it green.
#
# Dojo-dev-tree gate: SKIPs when DOJO_DEV_TREE=0 (see header comment) — dojo's payload is already
# checked where it is authored, and the rest of a target's TRACKED_MD is project-owned.
#
# Output: one DUPLICATE line per maximal run of shared windows, naming the number of distinct files
# across the whole run, the first 60 characters of the run, and EVERY file carrying any window of
# the run, each as file:line of its block (first-seen order). The union, not one window's file set:
# consecutive windows of a single run can occur in different files (a shares its first half with b
# and its second half with c), and naming only one window's files would hide a collider. So a false
# positive or a new duplication is diagnosable in one read without re-deriving which files collided.
# ---------------------------------------------------------------------------
check_duplicate_blocks() {
  echo "Checking for duplicated normative blocks (P5)..."

  if [ "$DOJO_DEV_TREE" -ne 1 ]; then
    echo "SKIP: [duplicate-blocks] dojo-dev-tree-only check — templates/stack.template.md is absent, so this is an installed target: dojo's own payload is already checked where it is authored, and this project's own agents, commands and docs are project-owned, not dojo's to police"
    return
  fi

  local scanned_file_count
  scanned_file_count="$(printf '%s\n' "$TRACKED_MD" | awk 'NF' | wc -l | tr -d ' ')"
  if [ "$scanned_file_count" -eq 0 ]; then
    echo "FAIL: [duplicate-blocks] self-assertion failed — scanned zero files (empty scope, see header comment's zero-file convention)"
    HARD_FAIL=1
    return
  fi

  local findings
  if ! findings="$(printf '%s\n' "$TRACKED_MD" | awk -v min_words=25 '
    function norm(s) { gsub(/[ \t\r]+/, " ", s); sub(/^ /, "", s); sub(/ $/, "", s); return s }
    # Record one normalized block: every min_words-word window it contains, per distinct file.
    function add_block(text, ln,   n, w, i, key) {
      if (text == "") return
      n = split(text, w, " ")
      if (n < min_words) return
      nblocks++
      btext[nblocks] = text
      for (i = 1; i + min_words - 1 <= n; i++) {
        key = window(w, i)
        if (!((key SUBSEP file) in seen)) {
          seen[key SUBSEP file] = 1; nfiles[key]++
          where[key] = where[key] (nfiles[key] > 1 ? ", " : "") file ":" ln
        }
      }
    }
    function window(w, i,   j, s) {
      s = w[i]
      for (j = i + 1; j < i + min_words; j++) s = s " " w[j]
      return s
    }
    function flush() { add_block(para, pstart); para = "" }
    {
      file = $0
      if (file == "") next
      para = ""; depth = 0; in_frontmatter = 0; fence = ""; ln = 0
      while ((rc = (getline raw < file)) > 0) {
        ln++
        if (ln == 1 && raw ~ /^---[ \t\r]*$/) { in_frontmatter = 1; continue }
        if (in_frontmatter) {
          if (raw ~ /^(---|\.\.\.)[ \t\r]*$/) { in_frontmatter = 0; continue }
          add_block(norm(raw), ln); continue
        }
        line = raw; d = 0
        while (sub(/^[ \t]*>[ \t]?/, "", line)) d++
        if (fence != "") {
          if (line ~ ("^[ \t]*" fence)) fence = ""
          else add_block(norm(line), ln)
          continue
        }
        if (d != depth) { flush(); depth = d }
        if (line ~ /^[ \t\r]*$/) { flush(); continue }
        if (line ~ /^[ \t]*```/) { flush(); fence = "```"; continue }
        if (line ~ /^[ \t]*~~~/) { flush(); fence = "~~~"; continue }
        if (line ~ /^[ \t]*#+([ \t]|$)/ || line ~ /^[ \t]*\|/) { flush(); add_block(norm(line), ln); continue }
        if (line ~ /^[ \t]*[-*_][ \t]*[-*_][ \t]*[-*_][-*_ \t]*$/) { flush(); continue }
        if (line ~ /^[ \t]*([-*+]|[0-9]+[.)])[ \t]+/) {
          flush()
          sub(/^[ \t]*([-*+]|[0-9]+[.)])[ \t]+/, "", line)
        }
        line = norm(line)
        if (para == "") { para = line; pstart = ln } else if (line != "") para = para " " line
      }
      if (rc < 0) print "UNREADABLE: " file
      flush()
      close(file)
    }
    END {
      # Walk blocks in scan order; report each maximal run of not-yet-reported shared windows once.
      for (b = 1; b <= nblocks; b++) {
        n = split(btext[b], w, " ")
        run = 0
        for (i = 1; i + min_words - 1 <= n + 1; i++) {
          shared = 0
          if (i + min_words - 1 <= n) {
            key = window(w, i)
            shared = (nfiles[key] >= 2 && !(key in reported))
          }
          if (shared) {
            reported[key] = 1
            if (!run) { run = 1; start = i; nrun = 0; files = ""; split("", inrun); split("", runfile) }
            # Union across the run: windows of one run can carry different file sets.
            m = split(where[key], parts, ", ")
            for (p = 1; p <= m; p++) {
              if (parts[p] in inrun) continue
              inrun[parts[p]] = 1
              files = files (files == "" ? "" : ", ") parts[p]
              f = parts[p]; sub(/:[0-9]+$/, "", f)
              if (!(f in runfile)) { runfile[f] = 1; nrun++ }
            }
          } else if (run) {
            run = 0
            excerpt = w[start]
            for (j = start + 1; j <= n && length(excerpt) < 60; j++) excerpt = excerpt " " w[j]
            printf "DUPLICATE (%d files): \"%s...\" in %s\n", nrun, substr(excerpt, 1, 60), files
          }
        }
      }
    }
  ' | sort)"; then
    echo "FAIL: [duplicate-blocks] the duplicate scan itself failed (see error output above) — refusing to report OK:"
    HARD_FAIL=1
    return
  fi

  if [ -n "$findings" ]; then
    echo "$findings"
    echo "FAIL: [duplicate-blocks] duplicated normative block(s) or unreadable file(s) found (see DUPLICATE/UNREADABLE line(s) above)"
    HARD_FAIL=1
  else
    echo "OK: [duplicate-blocks] no normative block duplicated across tracked files ($scanned_file_count file(s) scanned)"
  fi
}

# ---------------------------------------------------------------------------
# Check [config-priority-citation]: replaces Check [fallback-line]. Every SKILL.md carrying a
# "📋 Config Priority" line must cite the one canonical home, `.claude/skills/shared/config-priority.md`,
# rather than restating its text — restating it is exactly what check_duplicate_blocks() above now
# catches. This check therefore asserts only two things: the canonical home exists and ships, and
# every carrier cites it. It holds NO copy of the canonical text itself — unlike the
# check_fallback_line() this replaces, which hardcoded the very fallback passage it was auditing
# and was itself a 21st copy of the duplicated block.
#
# Skipped gracefully (like [coverage-doc]/[forbidden-doc]) when NO tracked SKILL.md carries a
# "📋 Config Priority" line at all — a minimal install (or a test fixture exercising an unrelated
# check) with no Config Priority carrier has nothing for this check to verify, and must not be
# forced to also ship a copy of config-priority.md it has no use for.
# ---------------------------------------------------------------------------
check_config_priority_citation() {
  echo "Checking Config Priority citation parity..."

  local canonical_doc=".claude/skills/shared/config-priority.md"
  local carriers=""
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      .claude/skills/*/SKILL.md) ;;
      *) continue ;;
    esac
    grep -qF '📋 Config Priority' "$f" || continue
    carriers="$carriers
$f"
  done < <(printf '%s\n' "$TRACKED_MD")

  if [ -z "$carriers" ]; then
    echo "SKIP: [config-priority-citation] no SKILL.md carries a Config Priority line"
    return
  fi

  if [ ! -f "$canonical_doc" ]; then
    echo "FAIL: [config-priority-citation] canonical home $canonical_doc does not exist, but at least one SKILL.md carries a Config Priority line"
    HARD_FAIL=1
    return
  fi
  if ! tracked_md_has "$canonical_doc"; then
    echo "FAIL: [config-priority-citation] $canonical_doc exists but is not git-tracked (would not ship)"
    HARD_FAIL=1
    return
  fi

  local citation_fail_count=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if ! grep -qE 'config-priority\.md(#[A-Za-z0-9_-]+)?' "$f"; then
      echo "  FAIL: $f carries a Config Priority line but does not cite $canonical_doc"
      citation_fail_count=$((citation_fail_count + 1))
    fi
  done <<< "$carriers"

  if [ "$citation_fail_count" -gt 0 ]; then
    echo "FAIL: [config-priority-citation] $citation_fail_count SKILL.md file(s) missing the config-priority.md citation"
    HARD_FAIL=1
  else
    echo "OK: [config-priority-citation] config-priority.md citation parity"
  fi
}

# ---------------------------------------------------------------------------
# Check [principles-doc]: structural conformance of `.claude/skills/shared/principles.md`, the one
# declared engineering-principle set, so the document cannot decay into prose. Assertions:
#   1. It exists and is in TRACKED_MD: install.sh's skills walk ships only what list_tracked()
#      returns, so an untracked copy would silently never reach a target.
#   2. It carries a `Consumers:` line.
#   3. Every `## P<n>` section carries a `<!-- consumed by: ... -->` marker, an axis
#      (inbound / outbound / both), a classification `(a)` or `(b)`, and an `Incident:` line with a
#      file:line reference or a code-spanned commit SHA.
#   4. Every `(b)` review-lens section contains exactly one question mark — its single falsifiable
#      question.
#   5. A `## Rejected` section exists, its top-level entries outnumber the admitted `## P<n>`
#      sections, and every entry names the gate it failed.
#   6. No `**Invariant:**` paragraph names a language construct (banned-noun list below).
#   7. Each principle section carries exactly one Layer-2 deferral to a `stack.md#` or
#      `best-practices.md#` anchor, written as a code span, never a markdown link (the target may not
#      exist in a fresh install), and that deferral is the section's last non-blank line.
#   8. No URL sits within three lines of a book-only source (Definition of Done, Boy Scout, The Lie,
#      REP, CCP, CRP, ADP, SDP, SAP): no post exists for those, so a URL near one is fabricated.
#
# Known brittleness, stated rather than hidden: assertions 4, 6 and 8 are text greps that rephrasing
# can evade. They are anti-decay pins, not proofs.
#
# Runs in an installed target too: the document ships under .claude/skills/shared/, so a corrupted
# or missing copy there is a real defect, and nothing here needs a dojo-dev-only file. It SKIPs only
# when the tree has neither the document nor anything that consumes it — no tracked
# `.claude/skills/tdd/SKILL.md` (the skill that carries the principles on every behavioral change)
# and no tracked file citing `principles.md` — which is what a minimal fixture exercising some other
# check looks like, and forcing that fixture to ship a principles document would be noise.
# ---------------------------------------------------------------------------
check_principles_doc() {
  echo "Checking the principles document (declared principle set)..."

  local doc=".claude/skills/shared/principles.md"
  local consumed=0 f
  if tracked_md_has ".claude/skills/tdd/SKILL.md"; then
    consumed=1
  else
    while IFS= read -r f; do
      [ -z "$f" ] || [ "$f" = "$doc" ] && continue
      if grep -qF 'principles.md' "$f" 2>/dev/null; then
        consumed=1
        break
      fi
    done < <(printf '%s\n' "$TRACKED_MD")
  fi

  if [ ! -f "$doc" ]; then
    if [ "$consumed" -eq 0 ]; then
      echo "SKIP: [principles-doc] no principles document and nothing that consumes one (no tracked tdd skill, no file citing principles.md)"
      return
    fi
    echo "FAIL: [principles-doc] $doc does not exist, but this tree ships a consumer of it"
    HARD_FAIL=1
    return
  fi
  if ! tracked_md_has "$doc"; then
    echo "FAIL: [principles-doc] $doc exists but is not git-tracked — install.sh's skills walk ships only what list_tracked() returns, so it would silently never reach a target"
    HARD_FAIL=1
    return
  fi

  # The banned language-construct nouns (assertion 6). This list WILL need extending as new
  # languages appear — extend it deliberately, one noun at a time; it is a keyword pin, not a parser.
  local banned_nouns="class interface module trait protocol decorator mixin generic annotation"

  # The awk program lives in a variable, outside any command substitution, so bash 3.2's
  # paren-counting scan of a substitution body never sees it (see the NOTE in check_links).
  # Backticks are built from their character code for the same reason, and to keep the source free
  # of literal code-span delimiters.
  local prog
  # shellcheck disable=SC2016 # an awk program: its $0/$1 are awk fields, never shell expansions
  prog='
    BEGIN {
      bt = sprintf("%c", 96)
      nb = split(banned, bn, " ")
      span_re = bt "[^" bt "]*(stack|best-practices)[.]md#[A-Za-z0-9_-]+" bt
      sha_re = bt "[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]+" bt
      fileline_re = "[A-Za-z0-9_./-]+[.][A-Za-z0-9]+:[0-9]+"
      book_re = "Definition of Done|Boy Scout|The Lie|(^|[^A-Za-z])(REP|CCP|CRP|ADP|SDP|SAP)([^A-Za-z]|$)"
      kind = ""
    }
    function close_entry() {
      if (entry != "" && entry !~ /[Gg]ate [123]/) print "REJECTED ENTRY WITHOUT GATE: " substr(entry, 1, 60)
      entry = ""
    }
    function close_section(   i, low, pat) {
      close_entry()
      if (kind != "p") return
      if (!marker) print "MISSING MARKER: " ph
      if (!axis) print "MISSING AXIS: " ph
      if (cls == "") print "MISSING CLASSIFICATION: " ph
      if (!incident) print "MISSING INCIDENT: " ph
      if (cls == "b" && qn != 1) print "QUESTION COUNT: " ph " has " qn " question mark(s); a (b) review lens carries exactly one falsifiable question"
      if (dlink) print "LINK DEFERRAL: " ph " defers Layer 2 with a markdown link; write it as a code span, the target may not exist in a fresh install"
      else if (nspan != 1) print "DEFERRAL: " ph " has " nspan " code-span Layer-2 deferral(s) to a stack.md# or best-practices.md# anchor; expected exactly one"
      else if (last !~ span_re) print "DEFERRAL POSITION: " ph " does not end with its Layer-2 deferral; the deferral is the last line of the section"
      if (inv == "") { print "MISSING INVARIANT: " ph; return }
      low = tolower(inv)
      for (i = 1; i <= nb; i++) {
        pat = "(^|[^a-z])" bn[i] "(es|s)?([^a-z]|$)"
        if (low ~ pat) print "BANNED NOUN: " ph " invariant names " sprintf("%c", 39) bn[i] sprintf("%c", 39) " — a language construct belongs in the Layer-2 expression, not the invariant"
      }
    }
    /^## / {
      close_section()
      h = substr($0, 4)
      if ($0 ~ /^## P[0-9]+([^0-9]|$)/) {
        kind = "p"; np++; ph = h
        marker = 0; axis = 0; cls = ""; incident = 0; qn = 0; nspan = 0; dlink = 0; inv = ""; in_inv = 0; last = ""
      } else if (tolower($0) ~ /^## rejected/) {
        kind = "r"; has_rej = 1
      } else kind = ""
      next
    }
    /^(\*\*)?Consumers:/ { consumers = 1 }
    /https?:\/\// { url[++nu] = NR; urltext[nu] = $0 }
    $0 ~ book_re { book[++nk] = NR }
    kind == "p" {
      if ($0 !~ /^[ \t]*$/) last = $0
      if ($0 ~ /<!-- consumed by: .*[^ ].* -->/) marker = 1
      if ($0 ~ /Axis:(\*\*)?[ \t]*(inbound|outbound|both)/) axis = 1
      if ($0 ~ /Classification:(\*\*)?[ \t]*\(b\)/) cls = "b"
      else if ($0 ~ /Classification:(\*\*)?[ \t]*\(a\)/) cls = "a"
      if ($0 ~ /Incident:/ && ($0 ~ fileline_re || $0 ~ sha_re)) incident = 1
      t = $0; qn += gsub(/\?/, "", t)
      if ($0 ~ /\]\([^ ]*(stack|best-practices)[.]md#[^ ]*\)/) dlink = 1
      t = $0
      while (match(t, span_re)) { nspan++; t = substr(t, RSTART + RLENGTH) }
      if ($0 ~ /^\*\*Invariant:\*\*/) { in_inv = 1; inv = $0 }
      else if (in_inv && $0 ~ /^[ \t]*$/) in_inv = 0
      else if (in_inv) inv = inv " " $0
      next
    }
    kind == "r" {
      if ($0 ~ /^- /) { close_entry(); nrej++; entry = $0 }
      else if (entry != "" && $0 ~ /^[ \t]+[^ \t]/) entry = entry " " $0
      else if ($0 ~ /^[ \t]*$/) close_entry()
      next
    }
    END {
      close_section()
      if (!consumers) print "MISSING CONSUMERS: no Consumers: line naming the skills and agents that cite this document"
      if (np == 0) print "NO PRINCIPLES: no ## P<n> principle section found"
      if (!has_rej) print "MISSING REJECTED: no ## Rejected section"
      else if (nrej <= np) print "REJECTED COUNT: " nrej " rejected vs " np " admitted; the rejected list must outnumber the admitted set"
      for (i = 1; i <= nu; i++) for (j = 1; j <= nk; j++) {
        d = url[i] - book[j]; if (d < 0) d = -d
        if (d <= 3) { print "BOOK URL: line " url[i] " cites a URL within 3 lines of a book-only source (line " book[j] "); name the book instead"; break }
      }
    }
  '

  local findings
  if ! findings="$(awk -v banned="$banned_nouns" "$prog" "$doc")"; then
    echo "FAIL: [principles-doc] the conformance scan itself failed (see error output above) — refusing to report OK:"
    HARD_FAIL=1
    return
  fi

  if [ -n "$findings" ]; then
    printf '%s\n' "$findings" | sed 's/^/  /'
    echo "FAIL: [principles-doc] $doc does not conform to the principle-set contract (see findings above)"
    HARD_FAIL=1
  else
    echo "OK: [principles-doc] $doc conforms (every principle carries marker, axis, classification, incident, invariant and one code-span deferral)"
  fi
}

# ---------------------------------------------------------------------------
# Check [desc-budget]: Description word-count budget — WARNING tier (mechanical surface of SDO,
# the skill-creator/optimize-skill description rule: what+when only, < 200 words, no followable
# workflow sequence). A slightly-long description is a smell, not a structural defect, so this
# never sets HARD_FAIL — see the header comment's WARNING-tier rationale.
#
# Scope: `.claude/skills/*/SKILL.md` filtered from TRACKED_MD (same derivation as
# [config-priority-citation], so it never rots as skills are added/removed).
#
# Counting method: extract the first `description:` line, strip the key, count words with `wc
# -w`. Single-line descriptions only — all current descriptions are single-line (max is 73
# words, stack-sync); multi-line/folded YAML would undercount, which is acceptable for a
# warning-tier mechanical check.
# ---------------------------------------------------------------------------
check_desc_budget() {
  echo "Checking description word-count budget..."
  local desc_budget_warn_count=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      .claude/skills/*/SKILL.md) ;;
      *) continue ;;
    esac
    local desc words
    desc="$(awk '/^description:/{sub(/^description: */,""); print; exit}' "$f")"
    [ -z "$desc" ] && continue
    words=$(printf '%s' "$desc" | wc -w | tr -d ' ')
    if [ "$words" -gt 200 ]; then
      echo "  WARNING: $f description is $words words (>200)"
      desc_budget_warn_count=$((desc_budget_warn_count + 1))
    fi
  done < <(printf '%s\n' "$TRACKED_MD")

  if [ "$desc_budget_warn_count" -gt 0 ]; then
    echo "WARNING: [desc-budget] $desc_budget_warn_count SKILL.md file(s) with a description over the 200-word budget"
  else
    echo "OK: [desc-budget] all descriptions within the 200-word budget"
  fi
}

# ---------------------------------------------------------------------------
# Dispatch table — one function per check, run in this fixed order. Add a new check by
# appending a `check_*` function above and its name to this list; nothing else needs updating.
# ---------------------------------------------------------------------------
CHECKS=(
  check_ai_mentions
  check_residue
  check_links
  check_ref_cycles
  check_fail_closed
  check_disclosure_slots
  check_repeatable_proof
  check_coverage_doc
  check_forbidden_doc
  check_anchors
  check_mentions
  check_artifacts
  check_tiers
  check_bestpractices
  check_duplicate_blocks
  check_config_priority_citation
  check_principles_doc
  check_desc_budget
)

for _check in "${CHECKS[@]}"; do
  "$_check"
done

echo "=== QA Audit Complete ==="
if [ "$HARD_FAIL" -eq 1 ]; then
  echo "RESULT: FAIL (hard failures found — see above)"
  exit 1
fi
echo "RESULT: PASS"
