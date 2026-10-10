#!/usr/bin/env node
// mint-an-app · build-mint.mjs — derive mint-data.json from the committed raw facts, DETERMINISTICALLY.
// No network, no clock: everything comes from mint-raw.json (what GitHub's API said) + the gated
// catalogue (which rows are even eligible) + the gated mint law (what shape each repo is). CI re-runs
// this and diffs, proving the shipped mint data was built by the law, not hand-typed.
import { readFileSync, writeFileSync } from 'node:fs';
import { classifyShape } from './mint.mjs';

const cat = JSON.parse(readFileSync('./catalogue-data.json', 'utf8'));
const raw = JSON.parse(readFileSync('./mint-raw.json', 'utf8'));

const rowByName = new Map(cat.rows.map((r) => [r.name, r]));
const apps = {};
let singles = 0, forks = 0, dropped = 0;

for (const name of Object.keys(raw.apps).sort()) {
  const row = rowByName.get(name);
  // A raw entry whose row is gone or no longer eligible (re-scanned downward, renamed, gone private)
  // is DROPPED, never shipped — the catalogue is the only door into the mint data.
  if (!row || row.mintEligible !== true) { dropped++; continue; }
  const r = raw.apps[name];
  if (!r || typeof r.sha !== 'string' || !/^[0-9a-f]{40}$/.test(r.sha)) { dropped++; continue; }

  const s = classifyShape(r.paths, r.htmlScan);
  const shape = s.ok ? s : { shape: 'multi', file: null, license: null, why: `${r.total} files — the app is the whole repo` };
  if (shape.shape === 'single') singles++; else forks++;

  apps[name] = {
    shape: shape.shape,
    file: shape.file,
    license: shape.license,
    spdx: typeof r.spdx === 'string' ? r.spdx : null,
    why: shape.why,
    branch: r.branch,
    sha: r.sha,
    runUrl: r.run && typeof r.run.url === 'string' ? r.run.url : null,
    runAt: r.run && typeof r.run.at === 'string' ? r.run.at : null,
    workflow: r.run && typeof r.run.workflow === 'string' ? r.run.workflow : null,
  };
}

writeFileSync('mint-data.json', JSON.stringify({ generatedAt: raw.generated, apps }));
console.log(`wrote mint-data.json: ${Object.keys(apps).length} mintable apps — ${singles} single-file downloads · ${forks} fork paths · ${dropped} raw entries dropped (no longer eligible)`);
