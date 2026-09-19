#!/usr/bin/env node
// mint-an-app · build-catalogue.mjs — the I/O half (ungated, same split as every claudedidy CLI
// wrapping a gated kernel): reads the REAL estate index + the REAL, freshly-scanned CI evidence,
// calls the gated buildCatalogue(), writes catalogue-data.json for the page to fetch. No decision
// logic here — catalogue.mjs is the law, this is just the file I/O around it.
//
// Regenerate the evidence itself with fallworld's own scripts (scan-ci.mjs then scan-tiers.mjs,
// vendored nowhere here on purpose — that scan is fallworld's job against the live estate, not
// something to fork a second copy of) and drop the resulting workflow-evidence.json in beside this
// file before re-running.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildCatalogue } from './catalogue.mjs';

// Reads a PUBLIC-ONLY snapshot of the estate index committed beside this file. The full index at
// ~/.claude/.../estate-index.json carries the 46 private repo names; vendoring the whole thing into a
// public repo would leak them (see memory pages-leak-sweep). catalogue.mjs already refuses private
// nodes, so a private-stripped index yields a byte-identical catalogue — and lets CI rebuild the data
// deterministically on GitHub's own runner (proving it was built by the gated law, not hand-typed).
// Regenerate this snapshot with: node make-public-index.mjs
const idx = JSON.parse(readFileSync('./estate-index-public.json', 'utf8'));
const evidence = JSON.parse(readFileSync('./workflow-evidence.json', 'utf8'));
const generatedAt = readFileSync('./.evidence-generated', 'utf8').trim().replace(/^generated:\s*/i, '');

const c = buildCatalogue(idx.nodes, evidence);
if (!c.ok) { console.error('REFUSED:', c.why); process.exit(1); }

writeFileSync('catalogue-data.json', JSON.stringify({
  generatedAt,
  estateGenerated: idx.generated,
  total: c.total,
  tally: c.tally,
  rows: c.rows,
}));

console.log(`wrote catalogue-data.json: ${c.total} rows — proven ${c.tally.proven} · works ${c.tally.works} · prototype ${c.tally.prototype}`);
