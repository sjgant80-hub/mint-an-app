// mint-an-app · catalogue.mjs — turn the estate's real index + real CI evidence into an honest,
// tiered catalogue. Every row's tier is COMPUTED by tier.mjs's tierOf() from real evidence gathered
// off GitHub's own API — never typed, never a claim a repo made about itself (same law, vendored
// verbatim from fallworld, not reimplemented — a second tier law beside a gated one is how the copy
// becomes the version people read).
//
// TWO REFUSALS THIS FILE EXISTS TO ENFORCE, BOTH SAFETY-SHAPED, NOT STYLE:
//   · a private repo NEVER enters this catalogue — this is a public minting surface, and silently
//     including a private node would leak its existence to it;
//   · a forked repo never enters either — a fork is not this estate's own work to mint out.
// Neither refusal is a maybe: catalogueRow returns {ok:false} for either, and buildCatalogue simply
// drops that node rather than ever rendering a row for it.
//
// A Prototype-tier repo still gets a row — NAMED, not hidden (same principle as
// witness-labels-never-deletes) — it is the mintEligible flag, not presence in the list, that keeps
// an unproven app from ever being sold as done.
//
// Pure and total: garbage in -> { ok:false, why }, never a throw.

import { tierOf, rank } from './tier.mjs';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;
const isStr = (v) => typeof v === 'string';

/**
 * catalogueRow(node, workflowEvidence) — node: one estate-index entry ({name, desc, url, live,
 * private, fork, pushed}). workflowEvidence: that repo's array from workflow-evidence.json, or
 * undefined if it has never been scanned (tierOf treats that honestly as Prototype, not as an
 * error — an unscanned repo is not a broken one, it is simply unmeasured).
 */
export function catalogueRow(node, workflowEvidence) {
  if (!isObj(node) || !isStr(node.name) || node.name.length === 0) return { ok: false, why: 'not a real estate-index node' };
  if (node.private === true) return { ok: false, why: 'private repos never enter a public catalogue' };
  if (node.fork === true) return { ok: false, why: 'a fork is not this estate\'s own work to mint out' };
  const evidence = isArr(workflowEvidence) ? workflowEvidence : [];
  const t = tierOf(evidence, { live: node.live === true });
  return {
    ok: true,
    row: {
      name: node.name,
      desc: isStr(node.desc) ? node.desc : '',
      url: isStr(node.url) ? node.url : null,
      tier: t.tier,
      why: t.why,
      mintEligible: t.tier === 'proven' || t.tier === 'works',
    },
  };
}

/**
 * buildCatalogue(nodes, evidenceByName) — nodes: the estate index array (estate-index.json's own
 * `.nodes`). evidenceByName: {repoName: [workflow records]}, from workflow-evidence.json. Every
 * real, public, non-fork node gets a row, ranked Proven > Works > Prototype then alphabetically, so
 * the sort order itself never depends on scan order or which repo happened to be listed first.
 */
export function buildCatalogue(nodes, evidenceByName) {
  if (!isArr(nodes)) return { ok: false, why: 'the estate index nodes must be an array' };
  const ev = isObj(evidenceByName) ? evidenceByName : {};
  const rows = [];
  for (const node of nodes) {
    const key = (isObj(node) && isStr(node.name)) ? node.name : '';
    const r = catalogueRow(node, ev[key]);
    if (r.ok) rows.push(r.row);
  }
  rows.sort((a, b) => (rank(b.tier) - rank(a.tier)) || a.name.localeCompare(b.name));
  const tally = { prototype: 0, works: 0, proven: 0 };
  for (const r of rows) tally[r.tier]++;
  return { ok: true, rows, tally, total: rows.length };
}
