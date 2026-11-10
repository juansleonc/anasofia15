# Detection artifact catalog

Bounded, documented set of lockfiles/configs/CI files `/stack-sync` and `scripts/stack_check.sh`
scan for. "Bounded" means: an ecosystem outside this table degrades to "undetected — add to
catalog" rather than silently guessing (ADR Consequences). Detection never fabricates a
technology or version that isn't backed by `file:line` evidence in one of these artifacts.

| Ecosystem | Artifact(s) | Version evidence | `stack_check.sh` status |
|---|---|---|---|
| Node.js | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` | `package-lock.json`: `packages[""].engines.node` (npm lockfile v2/v3 shape) | **implemented** — `package-lock.json` only, via `engines.node` |
| Ruby | `Gemfile.lock` | `RUBY VERSION` stanza (the runtime) | **implemented** — `Gemfile.lock` only, via `RUBY VERSION` |
| Go | `go.sum` / `go.mod` | `go <version>` directive in `go.mod` | documented, not yet wired |
| Rust | `Cargo.lock` | `[[package]] version = "<version>"` per crate | documented, not yet wired |
| Python | `requirements.txt`, `poetry.lock` | pinned `==<version>` / `[[package]]` blocks | documented, not yet wired |
| PHP | `composer.lock` | `packages[].version` | documented, not yet wired |
| CI | `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml` | runtime/action version pins | documented, not yet wired |

## Node.js detection (implemented)

`package-lock.json` (npm lockfile v2/v3) declares the pinned Node runtime range under
`packages[""].engines.node` when the project's `package.json` sets an `engines.node` constraint.
`stack_check.sh` greps the first `"node":` key in the file and reports:

```
node <version> (evidence: package-lock.json:<line>)
```

If the file has no `engines.node` entry, nothing is emitted for Node — absence of evidence is
never treated as absence-with-a-guessed-default; the section stays undetected.

## Ruby detection (implemented)

`Gemfile.lock`'s `RUBY VERSION` stanza pins the Ruby RUNTIME the bundle was resolved against —
the exact analogue of `engines.node` for Node. `stack_check.sh` reads the line following
`RUBY VERSION`, strips the recorded patch level (`3.2.2p53` → `3.2.2`), and reports:

```
ruby <version> (evidence: Gemfile.lock:<line>)
```

If the file has no `RUBY VERSION` stanza, nothing is emitted for Ruby — same contract as Node:
absence of evidence is never a guessed default. Per-gem detection (recognizing individual
gems as their own technology sections) is NOT part of this — see
"Extending this catalog" below.

## Extending this catalog

Per-dependency/framework detection (e.g. recognizing `express`, `rails`, `react` as their own <!-- residue-ok -->
technology sections) is an explicit future extension, not built into `stack_check.sh` v1 — no
test in `tests/` drives it yet, so it is not implemented, per this repo's TDD discipline (no
behavior without a driving test). Adding a new ecosystem or a per-dependency rule means: (1) add
a row to the table above, (2) add a case to `detect_artifacts()` in `stack_check.sh`, (3) add a
fixture + failing test in `tests/test_stack_check.sh` first.
