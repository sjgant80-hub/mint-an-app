# Mint an App

Vibecoding tools (Cursor, Copilot, v0, Lovable, Bolt, Replit) sell a blank page and a metered
model — you build from zero and own nothing at the end. This estate already has hundreds of real,
live, working apps. This is the honest catalogue of them: **own a pre-done app instead of building
one from scratch.**

Every tier badge is **computed**, never typed. `tier.mjs` (vendored verbatim from `fallworld`, not
reinvented) reads GitHub's own CI record for each repo — a mutation gate that ran and killed every
mutant is **Proven**; tests that ran and passed with nothing trying to break them is **Works**; no
machine has checked it yet is **Prototype**, named honestly, never sold as done.

## Phases

- **Phase 0 (done)** — regenerated the tier scan against the live estate (`fallworld`'s own
  `scan-ci.mjs` → `scan-tiers.mjs`, not forked, not reinvented). Fresh result: 864 root repos
  scanned (was 110), **89 Proven**, **171 Works**, **1,355 Prototype** — 260 apps genuinely ready
  to own.
- **Phase 1 (this repo, done)** — the browse-only catalogue. `catalogue.mjs` turns the real estate
  index + the real tier evidence into rows; private and forked repos never enter it, by construction.
  `build-catalogue.mjs` generates `catalogue-data.json` from the gated law — never hand-typed,
  CI diffs the rebuild to prove it. `index.html` renders it: search, filter by tier, real links out.
  No mint action yet — that would be a dead control before it exists.
- **Phase 2 (not yet built)** — the mint action itself, mapped per app: a single-file/zip download
  for the one-file HTML apps (no account, truest to "own it, no subscription"), a GitHub fork for
  apps that need an update path.
- **Expand leg (not yet built)** — once an AI-using app is owned, extend it locally via a cascade
  (local model first, escalate only on a real failure — a passing test suite or a cross-check, never
  format-validity alone, which does not transfer from classification to code).

## Regenerating the evidence

`workflow-evidence.json` is a dated snapshot (see `.evidence-generated`), not a live query — GitHub
Actions data has to be scanned, not fetched per page-load. Regenerate it with `fallworld`'s own
`scripts/scan-ci.mjs` then `scripts/scan-tiers.mjs` (that repo, not vendored here — this project
consumes the scan, it does not fork it), drop the resulting `workflow-evidence.json` in beside this
README, update `.evidence-generated`, then `node build-catalogue.mjs`.

No pricing anywhere on this page. Powered by the Konomi architecture, created by Thomas Frumkin.
MIT · AI-Native Solutions.
