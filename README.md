# Mint an App

**LIVE: https://sjgant80-hub.github.io/mint-an-app/** — browse the estate's real, gated apps and
walk out owning one.

Vibecoding tools (Cursor, Copilot, v0, Lovable, Bolt, Replit) sell a blank page and a metered
model — you build from zero and own nothing at the end. This estate already has hundreds of real,
live, working apps. This is the honest catalogue of them: **own a pre-done app instead of building
one from scratch.**

Every tier badge is **computed**, never typed. `tier.mjs` (vendored verbatim from `fallworld`, not
reinvented) reads GitHub's own CI record for each repo — a mutation gate that ran and killed every
mutant is **Proven**; tests that ran and passed with nothing trying to break them is **Works**; no
machine has checked it yet is **Prototype**, named honestly, never sold as done.

## Phases

- **Phase 0 (done, re-run fresh for Phase 2 on 2026-10-10)** — the tier scan against the live
  estate (`fallworld`'s own `scan-ci.mjs` → `scan-tiers.mjs`, not forked, not reinvented), full
  rescan, never incremental staleness: **211 Proven**, **126 Works**, **1,371 Prototype** —
  337 apps genuinely ready to own. Stale tier data never badges an app here.
- **Phase 1 (this repo, done)** — the browse-only catalogue. `catalogue.mjs` turns the real estate
  index + the real tier evidence into rows; private and forked repos never enter it, by construction.
  `build-catalogue.mjs` generates `catalogue-data.json` from the gated law — never hand-typed,
  CI diffs the rebuild to prove it. `index.html` renders it: search, filter by tier, real links out.
  No mint action yet — that would be a dead control before it exists.
- **Phase 2 (done)** — the mint action itself, mapped per app by the gated mint law (`mint.mjs`,
  witness-CLEAN; the live page imports the real kernel, so the gated logic IS the live logic):
  - **Own it — download** (single-file apps): the page's own text is verified self-contained
    (zero local references, zero loads it computes at runtime — `localRefs`/`classifyShape`), then
    one click fetches the REAL `index.html` straight off the repo's **pinned commit**, bundles it
    with the repo's licence and a `PROVENANCE.txt`, and downloads the zip (built in your own
    browser by the gated `storeZip` — deterministic bytes, STORE method). No account, no
    subscription, no phone-home.
  - **Fork it on GitHub** (multi-file apps): honest about what a fork is — your own copy, history
    and all, in your GitHub account; needs a GitHub login. No OAuth theatre pretending otherwise.
  - **Every minted bundle carries a re-runnable proof pointer**: the repo, the pinned SHA, the tier
    and why, and the CI run URL — so a buyer (or their agent) verifies on GitHub's own record
    before relying. `provenanceNote` REFUSES to write provenance for a prototype.
  - Only Proven/Works rows ever get a mint affordance — `mintDecision` re-checks the tier itself,
    so a lying data file still cannot render a mint control. Prototype stays visible, labelled,
    never sold.
  - Data flow: `scan-mint.mjs` gathers each eligible repo's facts off GitHub's API (branch, HEAD
    SHA, file tree, the page's text, licence, latest green run) into `mint-raw.json`;
    `build-mint.mjs` derives `mint-data.json` from it deterministically; CI rebuilds and diffs
    both, and checks every shipped mint entry is catalogue-eligible.
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
