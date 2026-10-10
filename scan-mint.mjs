#!/usr/bin/env node
// mint-an-app · scan-mint.mjs — the I/O half of Phase 2's evidence gathering (ungated, same split as
// build-catalogue.mjs). For every MINT-ELIGIBLE row of the freshly built catalogue, ask GitHub's own
// API for the facts the mint law decides from:
//   · the default branch and its HEAD commit (the PINNED SHA every minted copy cites),
//   · the real file tree at that commit (shape is computed from this, never guessed),
//   · index.html's own text when the tree says it might be single-file (the kernel scans it for
//     local references — a page that fetches a sibling file must never ship as a lone download),
//   · the repo's licence (SPDX id from the API + the LICENSE file's path from the tree),
//   · the latest SUCCESSFUL run of the workflow the tier was computed from — the re-runnable proof
//     pointer.
// Writes mint-raw.json (the committed raw facts; resumable — already-scanned repos are skipped, so
// delete the file for a full refresh). build-mint.mjs then derives mint-data.json from it
// DETERMINISTICALLY, which is what lets CI prove the shipped data was built by the gated law.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { localRefs } from './mint.mjs';

const OUT = 'mint-raw.json';
const MAX_PATHS = 80; // a repo with more files than this is never single-file; keep the committed raw lean

const cat = JSON.parse(readFileSync('./catalogue-data.json', 'utf8'));
const evidence = JSON.parse(readFileSync('./workflow-evidence.json', 'utf8'));
const eligible = cat.rows.filter((r) => r.mintEligible);

const gh = (args) => new Promise((res) => {
  execFile('gh', args, { encoding: 'utf8', maxBuffer: 5e7 }, (err, stdout) => res(err ? null : stdout));
});
const ghJson = async (path, jq) => {
  // ⚑ A FAILED READ IS NOT AN ANSWER (same lesson as fallworld's scan): ask up to 3 times, and if the
  // API still will not say, record nothing — the next run picks the repo up.
  for (let t = 0; t < 3; t++) {
    const raw = await gh(['api', path, '--jq', jq]);
    if (raw !== null) { try { return JSON.parse(raw); } catch { return null; } }
  }
  return null;
};

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { apps: {} };
const done = prev.apps || {};
const todo = eligible.filter((r) => !(r.name in done));
console.log(`mint-eligible ${eligible.length} · already scanned ${Object.keys(done).length} · to do ${todo.length}`);

let i = 0, n = 0;
async function lane() {
  while (i < todo.length) {
    const row = todo[i++];
    const name = row.name;
    const meta = await ghJson(`repos/sjgant80-hub/${name}`, '{branch: .default_branch, spdx: (.license.spdx_id // null)}');
    if (!meta || !meta.branch) { console.log(`  could not read ${name} — left for the next run`); continue; }
    const sha = await ghJson(`repos/sjgant80-hub/${name}/commits/${encodeURIComponent(meta.branch)}`, '{sha: .sha}');
    if (!sha || !/^[0-9a-f]{40}$/.test(sha.sha || '')) { console.log(`  no HEAD sha for ${name} — left for the next run`); continue; }
    const tree = await ghJson(`repos/sjgant80-hub/${name}/git/trees/${sha.sha}?recursive=1`,
      '{truncated: .truncated, total: ([.tree[] | select(.type=="blob")] | length), paths: [.tree[] | select(.type=="blob") | .path]}');
    if (!tree || !Array.isArray(tree.paths)) { console.log(`  no tree for ${name} — left for the next run`); continue; }

    // Committed raw stays lean: the shape law only reads top-level names, so a large repo's nested
    // paths are dropped (its page can still earn the download if its own text proves self-contained).
    const rec = {
      branch: meta.branch, sha: sha.sha, spdx: meta.spdx, total: tree.total,
      paths: tree.total <= MAX_PATHS ? tree.paths : tree.paths.filter((p) => !p.includes('/')),
      htmlScan: null, run: null,
    };
    const page = tree.paths.find((p) => !p.includes('/') && p.toLowerCase() === 'index.html');
    if (page) {
      const body = await ghJson(`repos/sjgant80-hub/${name}/contents/${encodeURIComponent(page)}?ref=${sha.sha}`, '{content: .content}');
      if (body && typeof body.content === 'string') {
        let html = '';
        try { html = Buffer.from(body.content.replace(/\s/g, ''), 'base64').toString('utf8'); } catch { html = ''; }
        const r = localRefs(html);
        if (r.ok) rec.htmlScan = { refs: r.refs, dynamic: r.dynamic }; // stays null on any failure — an unread page never earns "single"
      }
    }

    // The proof pointer: the latest green run of the workflow the tier itself was computed from.
    const flows = Array.isArray(evidence[name]) ? evidence[name] : [];
    const tierFlow = flows.find((f) => f.mutation === true && f.conclusion === 'success')
      || flows.find((f) => f.conclusion === 'success');
    if (tierFlow && tierFlow.path) {
      const base = tierFlow.path.split('/').pop();
      const run = await ghJson(`repos/sjgant80-hub/${name}/actions/workflows/${encodeURIComponent(base)}/runs?per_page=1&status=success`,
        '(.workflow_runs[0] // {}) | {url: .html_url, at: .updated_at, sha: .head_sha, workflow: .name}');
      if (run && typeof run.url === 'string' && run.url.startsWith('https://')) rec.run = run;
    }

    done[name] = rec;
    n++;
    if (n % 25 === 0) { writeFileSync(OUT, JSON.stringify({ generated: prev.generated || new Date().toISOString(), apps: done })); console.log(`  ${n}/${todo.length}`); }
  }
}
await Promise.all(Array.from({ length: 8 }, lane));

// ⚑ WRITE WHAT WAS LEARNED — the whole batch, not just every twenty-fifth (fallworld's own lesson).
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), apps: done }));

const vals = Object.values(done);
const singles = vals.filter((v) => v.htmlScan && v.htmlScan.refs.length === 0 && v.htmlScan.dynamic === 0).length;
const withRun = vals.filter((v) => v.run).length;
console.log(`\nwrote ${OUT}: ${vals.length} eligible repos scanned`);
console.log(`  verified self-contained single-file : ${singles}`);
console.log(`  with a live CI-run proof pointer    : ${withRun}`);
