import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogueRow, buildCatalogue } from './catalogue.mjs';

const PROVEN_EVIDENCE = [{ name: 'gate', path: '.github/workflows/gate.yml', conclusion: 'success', mutation: true, pinned: true, sha: 'a', at: '2026-09-19' }];
const WORKS_EVIDENCE = [{ name: 'ci', path: '.github/workflows/ci.yml', conclusion: 'success', mutation: false, pinned: false, sha: 'b', at: '2026-09-19' }];
const NO_EVIDENCE = [];

// ---- catalogueRow ----

test('catalogueRow computes PROVEN from real mutation-gate evidence, and marks it mint-eligible', () => {
  const r = catalogueRow({ name: 'fallbrain', desc: 'boot a company on local', url: 'https://x/fallbrain', live: true }, PROVEN_EVIDENCE);
  assert.equal(r.ok, true);
  assert.equal(r.row.tier, 'proven');
  assert.equal(r.row.mintEligible, true);
  assert.equal(r.row.name, 'fallbrain');
});

test('catalogueRow computes WORKS from green-but-no-mutation evidence, still mint-eligible', () => {
  const r = catalogueRow({ name: 'x', desc: '', url: null, live: true }, WORKS_EVIDENCE);
  assert.equal(r.row.tier, 'works');
  assert.equal(r.row.mintEligible, true);
});

test('catalogueRow computes PROTOTYPE from no evidence — named, but NOT mint-eligible', () => {
  const r = catalogueRow({ name: 'x', desc: '', url: null, live: true }, NO_EVIDENCE);
  assert.equal(r.row.tier, 'prototype');
  assert.equal(r.row.mintEligible, false);
  assert.ok(r.ok); // the row still exists — a Prototype is named, never hidden
});

test('catalogueRow refuses a PRIVATE node outright, regardless of how proven its evidence looks', () => {
  const r = catalogueRow({ name: 'secret-thing', desc: '', url: null, live: true, private: true }, PROVEN_EVIDENCE);
  assert.equal(r.ok, false);
  assert.match(r.why, /private repos never enter/);
});

test('catalogueRow refuses a FORKED node outright, regardless of how proven its evidence looks', () => {
  const r = catalogueRow({ name: 'someone-elses-work', desc: '', url: null, live: true, fork: true }, PROVEN_EVIDENCE);
  assert.equal(r.ok, false);
  assert.match(r.why, /not this estate's own work/);
});

test('catalogueRow refuses malformed/hostile node shapes without throwing', () => {
  assert.equal(catalogueRow(null, PROVEN_EVIDENCE).ok, false);
  assert.equal(catalogueRow({}, PROVEN_EVIDENCE).ok, false); // no name
  assert.equal(catalogueRow({ name: '' }, PROVEN_EVIDENCE).ok, false); // empty name
  const evilArr = Object.assign([], { name: 'x' });
  assert.equal(catalogueRow(evilArr, PROVEN_EVIDENCE).ok, false); // array masquerading as a node
});

test('catalogueRow passes the real `live` flag through to tierOf, changing the honest Prototype reason (kills ===→!==)', () => {
  const liveNoEvidence = catalogueRow({ name: 'x', live: true }, []);
  const deadNoEvidence = catalogueRow({ name: 'x', live: false }, []);
  assert.equal(liveNoEvidence.row.tier, 'prototype');
  assert.equal(deadNoEvidence.row.tier, 'prototype');
  assert.match(liveNoEvidence.row.why, /it opens, and no machine has ever checked/);
  assert.match(deadNoEvidence.row.why, /nothing runs it and nothing opens it/);
  assert.notEqual(liveNoEvidence.row.why, deadNoEvidence.row.why);
});

test('catalogueRow treats missing/non-array evidence as unscanned (Prototype), never throws', () => {
  const r1 = catalogueRow({ name: 'x', live: false }, undefined);
  assert.equal(r1.row.tier, 'prototype');
  const r2 = catalogueRow({ name: 'x', live: false }, 'not-an-array');
  assert.equal(r2.row.tier, 'prototype');
});

// ---- buildCatalogue ----

const NODES = [
  { name: 'proven-app', desc: 'a', url: 'u1', live: true },
  { name: 'works-app', desc: 'b', url: 'u2', live: true },
  { name: 'prototype-app', desc: 'c', url: 'u3', live: true },
  { name: 'private-app', desc: 'd', url: 'u4', live: true, private: true },
  { name: 'forked-app', desc: 'e', url: 'u5', live: true, fork: true },
];
const EVIDENCE = { 'proven-app': PROVEN_EVIDENCE, 'works-app': WORKS_EVIDENCE };

test('buildCatalogue drops private and forked nodes entirely — not just marks them ineligible', () => {
  const c = buildCatalogue(NODES, EVIDENCE);
  assert.equal(c.ok, true);
  const names = c.rows.map((r) => r.name);
  assert.equal(names.includes('private-app'), false);
  assert.equal(names.includes('forked-app'), false);
  assert.equal(c.total, 3);
});

test('buildCatalogue includes an unscanned repo as an honestly-named Prototype row', () => {
  const c = buildCatalogue(NODES, EVIDENCE);
  const proto = c.rows.find((r) => r.name === 'prototype-app');
  assert.ok(proto);
  assert.equal(proto.tier, 'prototype');
  assert.equal(proto.mintEligible, false);
});

test('buildCatalogue ranks Proven above Works above Prototype, ties broken alphabetically', () => {
  const c = buildCatalogue(NODES, EVIDENCE);
  assert.deepEqual(c.rows.map((r) => r.name), ['proven-app', 'works-app', 'prototype-app']);
});

test('buildCatalogue tally counts every tier, including zero, and matches the real total', () => {
  const c = buildCatalogue(NODES, EVIDENCE);
  assert.deepEqual(c.tally, { prototype: 1, works: 1, proven: 1 });
  assert.equal(c.tally.prototype + c.tally.works + c.tally.proven, c.total);
});

test('buildCatalogue sort order does not depend on input order (kills a stray comparator mutant)', () => {
  const reversed = [...NODES].reverse();
  const c1 = buildCatalogue(NODES, EVIDENCE);
  const c2 = buildCatalogue(reversed, EVIDENCE);
  assert.deepEqual(c1.rows.map((r) => r.name), c2.rows.map((r) => r.name));
});

test('buildCatalogue refuses malformed input without throwing', () => {
  assert.deepEqual(buildCatalogue(null, EVIDENCE), { ok: false, why: 'the estate index nodes must be an array' });
  assert.deepEqual(buildCatalogue('nope', EVIDENCE), { ok: false, why: 'the estate index nodes must be an array' });
  // a hostile evidenceByName should not crash — every row just falls back to Prototype
  const c = buildCatalogue(NODES, null);
  assert.equal(c.ok, true);
  assert.equal(c.tally.proven, 0);
});
