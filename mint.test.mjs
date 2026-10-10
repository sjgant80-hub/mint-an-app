// mint-an-app · mint.test.mjs — the mint law against its own examples. Every decision branch, the
// zip bytes checked at byte level (a bundle writer you cannot parse back is a bundle writer you are
// trusting, not testing), crc32 against the published vectors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isMetaFile, isLocalRef, localRefs, classifyShape, mintDecision, provenanceNote, crc32, storeZip } from './mint.mjs';

const enc = new TextEncoder();

// ── isMetaFile ───────────────────────────────────────────────────────────────────────────────────
test('meta files: CI, docs, tests, licence, readme, repo plumbing', () => {
  for (const p of ['.github/workflows/gate.yml', '.github/FUNDING.yml', 'README.md', 'readme.txt', 'README',
    'docs/notes.md', 'deep/nested/file.md', 'kernel.test.mjs', 'sub/dir/x.test.js', 'LICENSE', 'LICENSE.md',
    'licence.txt', 'LICENCE', 'CNAME', 'cname', '.nojekyll', '.gitignore', '.gitattributes', '.gitmodules',
    'package.json', 'package-lock.json', 'witness.baseline.json', '.evidence-generated']) {
    assert.equal(isMetaFile(p), true, `${p} should be meta`);
  }
});
test('runtime files: the app itself, kernels, nested anything', () => {
  for (const p of ['index.html', 'app.html', 'kernel.mjs', 'style.css', 'data.json', 'sw.js',
    'sub/package.json', 'assets/logo.png', 'lib/witness.baseline.json', 'test.mjs', 'mytest.js']) {
    assert.equal(isMetaFile(p), false, `${p} should be runtime`);
  }
});
test('isMetaFile on garbage is false, never a throw', () => {
  for (const v of [null, undefined, 42, {}, [], '']) assert.equal(isMetaFile(v), false);
});

// ── isLocalRef / localRefs ───────────────────────────────────────────────────────────────────────
test('local vs external references', () => {
  for (const r of ['./k.mjs', 'x.json', '/abs/path.js', 'file.css', ' padded.js ']) {
    assert.equal(isLocalRef(r), true, `${r} is local`);
  }
  for (const r of ['', '   ', '#top', 'data:image/png;base64,x', 'blob:xyz', 'mailto:a@b.c', 'tel:+44',
    'javascript:void(0)', 'http://a.b', 'https://a.b/c', 'HTTPS://A.B', '//cdn.example.com/x.js',
    null, undefined, 7, {}]) {
    assert.equal(isLocalRef(r), false, `${String(r)} is not local`);
  }
});
test('localRefs finds every kind of reference the page can make', () => {
  const html = `<link href='style.css'><script src="app.js"></script>
    <script type="module">import { x } from './kernel.mjs'; import('lazy.mjs');
    fetch("data.json"); new Worker('w.js'); navigator.serviceWorker.register('sw.js');</script>
    <a href="#top">top</a> <a href="https://github.com/x">ext</a>
    <img src="data:image/png;base64,AAAA"> <script src="https://cdn.example.com/lib.js"></script>`;
  const r = localRefs(html);
  assert.equal(r.ok, true);
  assert.deepEqual([...r.refs].sort(), ['./kernel.mjs', 'app.js', 'data.json', 'lazy.mjs', 'style.css', 'sw.js', 'w.js'].sort());
  assert.equal(r.dynamic, 0, 'every loader call-site is accounted for by a literal');
});
test('localRefs: a fully self-contained page has zero refs and zero dynamic loads', () => {
  const r = localRefs(`<html><head><link rel="icon" href="data:image/svg+xml,x"></head>
    <body><a href="https://github.com/sjgant80-hub/x">repo</a><script>const a=1;</script></body></html>`);
  assert.equal(r.ok, true);
  assert.deepEqual(r.refs, []);
  assert.equal(r.dynamic, 0);
});
test('localRefs counts every loader call-site a literal cannot account for', () => {
  assert.equal(localRefs('fetch(`${name}.json`)').dynamic, 1);
  assert.equal(localRefs('const m = await import(mod);').dynamic, 1);
  assert.equal(localRefs('new Worker(path)').dynamic, 1);
  assert.equal(localRefs('navigator.serviceWorker.register(swUrl)').dynamic, 1);
  assert.equal(localRefs('fetch("a.json"); fetch(computed);').dynamic, 1, 'one literal, one computed');
  assert.equal(localRefs('fetch("https://api.example.com/x")').dynamic, 0, 'an external literal still counts as accounted for');
  assert.equal(localRefs('const x = new XMLHttpRequest();').dynamic, 1, 'XHR targets are runtime values');
});
test('localRefs dedupes and refuses non-strings', () => {
  const r = localRefs(`<script src="a.js"></script><script src="a.js"></script>`);
  assert.deepEqual(r.refs, ['a.js']);
  for (const v of [null, undefined, 42, {}, []]) {
    const bad = localRefs(v);
    assert.equal(bad.ok, false);
    assert.ok(bad.why.length > 0);
  }
});

// ── classifyShape ────────────────────────────────────────────────────────────────────────────────
const CLEAN = { refs: [], dynamic: 0 };
test('classifyShape: garbage in -> refusal, never a throw', () => {
  for (const v of [null, undefined, 'x', {}, [], [1], ['ok.html', ''], ['ok.html', null]]) {
    const r = classifyShape(v, CLEAN);
    assert.equal(r.ok, false);
    assert.ok(r.why.length > 0);
  }
});
test('single: a verified self-contained page beside its own source and gate', () => {
  const r = classifyShape(['index.html', 'kernel.mjs', 'kernel.test.mjs', 'README.md', 'LICENSE', '.github/workflows/gate.yml'], CLEAN);
  assert.equal(r.ok, true);
  assert.equal(r.shape, 'single');
  assert.equal(r.file, 'index.html');
  assert.equal(r.license, 'LICENSE');
  assert.match(r.why, /source and gate/);
});
test('single: a lone page says the file IS the app', () => {
  const r = classifyShape(['index.html', 'README.md'], CLEAN);
  assert.equal(r.shape, 'single');
  assert.match(r.why, /file IS the app/);
});
test('single: case of the filename is preserved but matched case-insensitively', () => {
  const r = classifyShape(['Index.HTML'], CLEAN);
  assert.equal(r.shape, 'single');
  assert.equal(r.file, 'Index.HTML');
  assert.equal(r.license, null);
});
test('multi: no top-level index.html means nothing standalone to download', () => {
  for (const paths of [['app.html'], ['docs/index.html', 'cli.mjs'], ['README.md', 'LICENSE']]) {
    const r = classifyShape(paths, CLEAN);
    assert.equal(r.shape, 'multi', JSON.stringify(paths));
    assert.match(r.why, /no top-level index\.html/);
    assert.equal(r.file, null);
  }
});
test('multi: an unread or malformed page scan can never earn the single verdict', () => {
  for (const scan of [null, undefined, 'nope', [], { refs: null, dynamic: 0 }, { refs: [] },
    { refs: [], dynamic: 'x' }, { refs: [], dynamic: -1 }, { refs: [], dynamic: 1.5 }]) {
    const r = classifyShape(['index.html'], scan);
    assert.equal(r.shape, 'multi', JSON.stringify(scan));
    assert.match(r.why, /never read|unverified/);
  }
});
test('multi: computed loads are unverifiable, singular and plural', () => {
  const one = classifyShape(['index.html'], { refs: [], dynamic: 1 });
  assert.equal(one.shape, 'multi');
  assert.match(one.why, /1 load it computes at runtime/);
  assert.match(classifyShape(['index.html'], { refs: [], dynamic: 2 }).why, /2 loads it computes/);
});
test('multi: a page that references local files is not self-contained', () => {
  const r = classifyShape(['index.html'], { refs: ['witness.baseline.json'], dynamic: 0 });
  assert.equal(r.shape, 'multi');
  assert.match(r.why, /references 1 local file —/, 'exactly one ref is singular');
  assert.match(classifyShape(['index.html'], { refs: ['a.js', 'b.js'], dynamic: 0 }).why, /references 2 local files/);
});
test('licence is found top-level only, first match, any spelling', () => {
  assert.equal(classifyShape(['index.html', 'licence.md'], CLEAN).license, 'licence.md');
  assert.equal(classifyShape(['index.html', 'docs/LICENSE'], CLEAN).license, null);
  assert.equal(classifyShape(['index.html', 'LICENSE-MIT'], CLEAN).license, null);
  assert.equal(classifyShape(['app.html', 'LICENSE'], CLEAN).license, 'LICENSE', 'licence reported even on the fork path');
});

// ── mintDecision ─────────────────────────────────────────────────────────────────────────────────
const SINGLE = { shape: 'single', file: 'index.html', license: 'LICENSE' };
test('a prototype is never sold, whatever its shape', () => {
  for (const row of [{ tier: 'prototype' }, { tier: 'Prototype' }, { tier: 'proven ' }, { tier: '' }, {}, null, 'x', { tier: 7 }]) {
    const d = mintDecision(row, SINGLE);
    assert.equal(d.kind, 'none', JSON.stringify(row));
  }
  assert.match(mintDecision({ tier: 'prototype' }, SINGLE).why, /never sold/);
});
test('proven + single-file -> download, licence carried', () => {
  const d = mintDecision({ tier: 'proven', name: 'x' }, SINGLE);
  assert.equal(d.kind, 'download');
  assert.equal(d.file, 'index.html');
  assert.equal(d.license, 'LICENSE');
});
test('works + single-file -> download; missing licence -> null', () => {
  const d = mintDecision({ tier: 'works' }, { shape: 'single', file: 'index.html', license: 42 });
  assert.equal(d.kind, 'download');
  assert.equal(d.license, null);
});
test('eligible + multi/unknown/broken shape -> fork, never a broken download', () => {
  for (const shape of [{ shape: 'multi' }, null, undefined, 'x', { shape: 'single' }, { shape: 'single', file: '' }, { shape: 'single', file: 9 }]) {
    assert.equal(mintDecision({ tier: 'proven' }, shape).kind, 'fork', JSON.stringify(shape));
  }
  assert.match(mintDecision({ tier: 'works' }, { shape: 'multi' }).why, /fork/i);
});

// ── provenanceNote ───────────────────────────────────────────────────────────────────────────────
const SHA = 'a'.repeat(40);
const GOOD = { name: 'fallbrain', tier: 'proven', why: 'gate ran', sha: SHA, mintedAt: '2026-10-10T12:00:00Z', generatedAt: '2026-10-10' };
test('provenance refuses garbage, prototypes, bad shas, bad urls', () => {
  const bads = [
    null, 'x', {},
    { ...GOOD, name: 'has space' }, { ...GOOD, name: '' },
    { ...GOOD, tier: 'prototype' }, { ...GOOD, tier: 'PROVEN' },
    { ...GOOD, sha: 'abc' }, { ...GOOD, sha: SHA.toUpperCase() }, { ...GOOD, sha: null },
    { ...GOOD, mintedAt: '' }, { ...GOOD, mintedAt: 7 },
    { ...GOOD, generatedAt: '' },
    { ...GOOD, runUrl: 'http://insecure' }, { ...GOOD, runUrl: 42 },
  ];
  for (const b of bads) {
    const r = provenanceNote(b);
    assert.equal(r.ok, false, JSON.stringify(b));
    assert.ok(r.why.length > 0);
  }
  assert.match(provenanceNote({ ...GOOD, tier: 'prototype' }).why, /never written for an unproven/);
});
test('provenance carries the full re-runnable proof pointer', () => {
  const r = provenanceNote({ ...GOOD, runUrl: 'https://github.com/sjgant80-hub/fallbrain/actions/runs/123', workflow: 'proof-of-play', licenseNote: 'MIT (LICENSE included)' });
  assert.equal(r.ok, true);
  const t = r.text;
  assert.match(t, /PROVENANCE — fallbrain/);
  assert.match(t, /https:\/\/github\.com\/sjgant80-hub\/fallbrain\n/);
  assert.ok(t.includes(`pinned:   ${SHA}`));
  assert.match(t, /PROVEN — gate ran/);
  assert.match(t, /actions\/runs\/123 \(proof-of-play\)/);
  assert.ok(t.includes(`https://raw.githubusercontent.com/sjgant80-hub/fallbrain/${SHA}/index.html`));
  assert.match(t, /tier data generated 2026-10-10/);
  assert.match(t, /minted:   2026-10-10T12:00:00Z/);
  assert.match(t, /licence:  MIT \(LICENSE included\)/);
  assert.match(t, /Thomas Frumkin/);
  assert.ok(t.endsWith('\n'));
  assert.ok(!/£\d|\$\d/.test(t), 'no pricing in a provenance note');
});
test('an empty or non-string licence note falls back to the default line', () => {
  for (const note of ['', 42, null]) {
    const r = provenanceNote({ ...GOOD, licenseNote: note });
    assert.equal(r.ok, true);
    assert.match(r.text, /licence:  see the LICENSE file/, `licenseNote=${JSON.stringify(note)}`);
  }
});
test('an empty or non-string workflow never renders empty parens after the run URL', () => {
  for (const wf of ['', 42, null]) {
    const r = provenanceNote({ ...GOOD, runUrl: 'https://github.com/sjgant80-hub/fallbrain/actions/runs/9', workflow: wf });
    assert.equal(r.ok, true);
    assert.match(r.text, /actions\/runs\/9\n/, `workflow=${JSON.stringify(wf)} must end the line clean`);
  }
});
test('provenance without a run URL points at the Actions record; default licence line', () => {
  const r = provenanceNote(GOOD);
  assert.equal(r.ok, true);
  assert.match(r.text, /ci run:   https:\/\/github\.com\/sjgant80-hub\/fallbrain\/actions /);
  assert.match(r.text, /licence:  see the LICENSE file/);
  assert.match(r.text, /tier law/);
});
test('provenance for works says WORKS', () => {
  const r = provenanceNote({ ...GOOD, tier: 'works', why: 'tests passed' });
  assert.match(r.text, /WORKS — tests passed/);
});

// ── crc32 ────────────────────────────────────────────────────────────────────────────────────────
test('crc32 against the published vectors', () => {
  assert.equal(crc32(new Uint8Array(0)), 0);
  assert.equal(crc32(enc.encode('abc')), 0x352441C2);
  assert.equal(crc32(enc.encode('123456789')), 0xCBF43926);
  assert.equal(crc32(new Uint8Array([0])), 0xD202EF8D);
});
test('crc32 refuses non-bytes', () => {
  for (const v of ['abc', null, undefined, [1, 2], {}]) assert.equal(crc32(v), null);
});

// ── storeZip ─────────────────────────────────────────────────────────────────────────────────────
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

test('storeZip refuses garbage and unsafe paths', () => {
  const bads = [
    null, 'x', {}, [],
    [{ name: '', data: 'x' }], [{ name: 'a\\b', data: 'x' }], [{ name: '/abs', data: 'x' }],
    [{ name: '../up', data: 'x' }], [{ name: 'a/../b', data: 'x' }], [{ name: 'a/./b', data: 'x' }],
    [{ name: 'a//b', data: 'x' }], [{ name: 'x'.repeat(513), data: 'x' }],
    [{ name: 'a', data: 'x' }, { name: 'a', data: 'y' }],
    [{ name: 'a', data: 42 }], [{ name: 'a' }], [{ data: 'x' }], ['str'],
  ];
  for (const b of bads) {
    const r = storeZip(b);
    assert.equal(r.ok, false, JSON.stringify(b));
    assert.ok(r.why.length > 0);
  }
});
test('one entry: every header field byte-checked', () => {
  const data = enc.encode('hello');
  const r = storeZip([{ name: 'a.txt', data: 'hello' }]);
  assert.equal(r.ok, true);
  const b = r.bytes;
  // local header
  assert.equal(u32(b, 0), 0x04034b50);
  assert.equal(u16(b, 4), 20);           // version needed
  assert.equal(u16(b, 6), 0x0800);       // utf-8 flag
  assert.equal(u16(b, 8), 0);            // STORE
  assert.equal(u16(b, 10), 0);           // dos time — fixed for determinism
  assert.equal(u16(b, 12), 0x21);        // dos date 1980-01-01
  assert.equal(u32(b, 14), crc32(data));
  assert.equal(u32(b, 18), 5);           // csize
  assert.equal(u32(b, 22), 5);           // usize
  assert.equal(u16(b, 26), 5);           // name length
  assert.equal(u16(b, 28), 0);           // extra length
  assert.equal(new TextDecoder().decode(b.slice(30, 35)), 'a.txt');
  assert.equal(new TextDecoder().decode(b.slice(35, 40)), 'hello');
  // end of central directory
  const e = b.length - 22;
  assert.equal(u32(b, e), 0x06054b50);
  assert.equal(u16(b, e + 8), 1);        // entries this disk
  assert.equal(u16(b, e + 10), 1);       // entries total
  const cdSize = u32(b, e + 12), cdOff = u32(b, e + 16);
  assert.equal(cdOff, 40);               // central dir starts right after the one local entry
  assert.equal(cdSize, 46 + 5);          // one central record + name
  assert.equal(u16(b, e + 20), 0);       // no comment
  // central record
  assert.equal(u32(b, cdOff), 0x02014b50);
  assert.equal(u32(b, cdOff + 16), crc32(data));
  assert.equal(u32(b, cdOff + 20), 5);
  assert.equal(u32(b, cdOff + 24), 5);
  assert.equal(u32(b, cdOff + 42), 0);   // local header offset
  assert.equal(new TextDecoder().decode(b.slice(cdOff + 46, cdOff + 51)), 'a.txt');
});
test('two entries: offsets chain, both parse back to their bytes', () => {
  const r = storeZip([
    { name: 'app/index.html', data: '<html>x</html>' },
    { name: 'app/PROVENANCE.txt', data: new Uint8Array([1, 2, 3]) },
  ]);
  assert.equal(r.ok, true);
  const b = r.bytes;
  const e = b.length - 22;
  assert.equal(u16(b, e + 10), 2);
  const cdOff = u32(b, e + 16);
  // first central record points at offset 0, second at 30+14+14=58
  assert.equal(u32(b, cdOff + 42), 0);
  const rec2 = cdOff + 46 + u16(b, cdOff + 28);
  assert.equal(u32(b, rec2), 0x02014b50);
  assert.equal(u32(b, rec2 + 42), 30 + 14 + 14);
  // second entry's stored bytes
  const off2 = u32(b, rec2 + 42);
  const name2len = u16(b, off2 + 26);
  assert.deepEqual([...b.slice(off2 + 30 + name2len, off2 + 30 + name2len + 3)], [1, 2, 3]);
});
test('an archive path of exactly 512 chars is allowed; 513 is not', () => {
  assert.equal(storeZip([{ name: 'x'.repeat(512), data: 'ok' }]).ok, true);
  assert.equal(storeZip([{ name: 'x'.repeat(513), data: 'no' }]).ok, false);
});
test('deterministic: same entries, same bytes', () => {
  const mk = () => storeZip([{ name: 'x.txt', data: 'same' }, { name: 'y.txt', data: 'bytes' }]).bytes.join(',');
  assert.equal(mk(), mk());
});
