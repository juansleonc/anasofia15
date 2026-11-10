---
name: delivery-lane
description: Single decision rule for choosing a delivery lane for new work — exactly one testable behavior takes the fast-path, anything else becomes an OpenSpec change on schema: dojo driven end to end by /orchestrate. States the artifact-placement table and the investigations/ slug rule. Cited, never restated, by CLAUDE.md, templates/CLAUDE.project.md, and architect/SKILL.md.
---

# Delivery lane

> One authoritative copy. Cite this file instead of restating its rule.

## The rule

Exactly one testable behavior: take the fast-path. Anything else: open an OpenSpec change on
`schema: dojo`, driven end to end by `/orchestrate` (validator gate, evidence ladder, scenarios
as contracts).

## Artifact placement

| Tracked, `openspec/changes/<c>/` | Untracked, `investigations/<c>/` (same slug as the change) |
|---|---|
| proposal, specs, design, tasks, verify-report | `architecture.md` (mandatory) · `orchestration-log.md` · `findings.md` · `seed_*`/`verify_*` scripts · `scenarios.md` (fast-path only) |

## Slug rule

The investigations folder name and the OpenSpec change name are the same slug — "which change
does this log belong to" is then a plain string-equality check.

## Direct /opsx:* calls

Calling `/opsx:new`, `/opsx:ff`, `/opsx:continue`, `/opsx:apply`, or `/opsx:archive` directly,
outside `/orchestrate`, is the ungated lane: no validator, no evidence ladder.
