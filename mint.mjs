// mint-an-app · mint.mjs — THE MINT LAW. Phase 2's gated kernel: what "own it" means, decided from
// evidence, never from hope.
//
// FOUR DECISIONS LIVE HERE AND NOWHERE ELSE:
//   · classifyShape — can a visitor own this app by DOWNLOADING its real index.html (single), or
//     only by FORKING the repo (multi)? The verdict comes from the page's OWN TEXT: a page earns
//     "single" only when it references zero local files AND makes zero loads the scanner cannot
//     resolve. The repo carrying its kernel source and tests beside the page does NOT block the
//     download — under the estate's kernel-backed-pages doctrine the sealed page IS the product,
//     and the source/gate beside it is what the fork path is for.
//   · mintDecision — who gets a mint affordance at all. ONLY proven/works. A prototype is named,
//     never sold — the same refusal catalogue.mjs makes, enforced again here so the page cannot
//     render a mint control the law did not grant.
//   · provenanceNote — every minted copy carries a RE-RUNNABLE proof pointer: repo, pinned SHA,
//     tier + why, the CI run URL. It REFUSES to write provenance for a prototype: a provenance note
//     for an unproven app must never exist.
//   · storeZip / crc32 — the bundle itself (app + licence + provenance), built byte-deterministically
//     in the visitor's own browser. STORE method, fixed DOS timestamp, so the same inputs always
//     yield the same bytes.
//
// Pure and total: no I/O, no clock, no network. Garbage in -> { ok:false, why }, never a throw.
// Browser-safe: no node imports (the live page imports THIS file — the gated logic IS the live logic).

const isArr = Array.isArray;
const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !isArr(v);

// ── what counts as a RUNTIME file ────────────────────────────────────────────────────────────────
// Conservative by construction: anything not provably meta counts as runtime, and any runtime file
// besides index.html means MULTI (fork path). Wrongly calling a single-file app multi costs a click;
// wrongly calling a multi-file app single hands someone a broken download. Only one of those is safe.

const META_EXACT = new Set(['cname', '.nojekyll', '.gitignore', '.gitattributes', '.gitmodules',
  'package.json', 'package-lock.json', 'witness.baseline.json', '.evidence-generated']);

export function isMetaFile(path) {
  if (!isStr(path) || path.length === 0) return false;
  const p = path.toLowerCase();
  if (p.startsWith('.github/')) return true;           // CI is not the app
  if (p.endsWith('.md')) return true;                  // docs do not run
  if (/\.test\.(mjs|js)$/.test(p)) return true;        // tests are the gate's food, not the app
  if (p.includes('/')) return false;                   // everything else nested is runtime
  if (META_EXACT.has(p)) return true;
  if (/^licen[cs]e(\..+)?$/.test(p)) return true;
  if (/^readme(\..+)?$/.test(p)) return true;
  return false;
}

// ── the page's own references ────────────────────────────────────────────────────────────────────
// The html text is scanned for every reference it makes. Any LOCAL one (not http(s)/data/#/mailto/
// blob) blocks the single-file verdict — the download alone would be broken. And every loader
// CALL-SITE (fetch / dynamic import / Worker / serviceWorker.register) must be accounted for by a
// string literal: a computed load like fetch(`${x}.json`) cannot be verified, so it blocks the
// verdict too. A commented-out reference still counts — conservative is the safe direction.

const QUOTED = `\\s*=\\s*(?:"([^"]*)"|'([^']*)')`;
const CALLED = `\\s*\\(\\s*(?:"([^"]*)"|'([^']*)')`;
const REF_PATTERNS = [
  new RegExp(`\\b(?:src|href)${QUOTED}`, 'gi'),
  new RegExp(`\\bimport\\b[^'"\\n]*\\bfrom\\s*(?:"([^"]*)"|'([^']*)')`, 'gi'),
  new RegExp(`\\bimport${CALLED}`, 'gi'),
  new RegExp(`\\bfetch${CALLED}`, 'gi'),
  new RegExp(`\\bnew\\s+Worker${CALLED}`, 'gi'),
  new RegExp(`\\bserviceWorker\\s*\\.\\s*register${CALLED}`, 'gi'),
];

export function isLocalRef(ref) {
  if (!isStr(ref)) return false;
  const r = ref.trim();
  if (r === '') return false;
  if (/^(#|data:|blob:|mailto:|tel:|javascript:|https?:\/\/|\/\/)/i.test(r)) return false;
  return true;
}

// Loader call-sites that MUST each be matched by a string literal, or the page is unverifiable.
const CALL_SITES = [/\bfetch\s*\(/g, /\bimport\s*\(/g, /\bnew\s+Worker\s*\(/g, /\bserviceWorker\s*\.\s*register\s*\(/g];
const CALL_LITERALS = [
  new RegExp(`\\bfetch${CALLED}`, 'g'),
  new RegExp(`\\bimport${CALLED}`, 'g'),
  new RegExp(`\\bnew\\s+Worker${CALLED}`, 'g'),
  new RegExp(`\\bserviceWorker\\s*\\.\\s*register${CALLED}`, 'g'),
];
const countMatches = (re, s) => { re.lastIndex = 0; let n = 0; while (re.exec(s) !== null) n++; return n; };

export function localRefs(html) {
  if (!isStr(html)) return { ok: false, why: 'the page text must be a string' };
  const refs = [];
  for (const pat of REF_PATTERNS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(html)) !== null) {
      const ref = m[1] !== undefined ? m[1] : m[2];
      if (isLocalRef(ref) && !refs.includes(ref.trim())) refs.push(ref.trim());
    }
  }
  let dynamic = 0;
  for (let i = 0; i < CALL_SITES.length; i++) {
    // Every literal match is also a call-site match, so this difference is never negative — and if
    // that invariant ever broke, classifyShape refuses a negative dynamic as unverified anyway.
    dynamic += countMatches(CALL_SITES[i], html) - countMatches(CALL_LITERALS[i], html);
  }
  if (/\bXMLHttpRequest\b/.test(html)) dynamic += 1; // XHR targets are runtime values — unverifiable
  return { ok: true, refs, dynamic };
}

// ── shape ────────────────────────────────────────────────────────────────────────────────────────
/**
 * classifyShape(paths, htmlScan) — paths: the repo's file list from GitHub's own git tree (blobs
 * only; may be the top-level subset for a large repo — the verdict only reads top-level names).
 * htmlScan: localRefs() of the repo's own index.html ({ refs, dynamic }), or null/undefined when the
 * page was never read — an unread page can never earn the single-file verdict.
 */
export function classifyShape(paths, htmlScan) {
  if (!isArr(paths) || paths.length === 0 || !paths.every((p) => isStr(p) && p.length > 0)) {
    return { ok: false, why: 'the file list must be a non-empty array of path strings' };
  }
  const license = paths.find((p) => !p.includes('/') && /^licen[cs]e(\..+)?$/i.test(p)) || null;
  const file = paths.find((p) => !p.includes('/') && p.toLowerCase() === 'index.html') || null;
  if (!file) {
    return { ok: true, shape: 'multi', file: null, license, why: 'no top-level index.html — nothing standalone to download, the app is the whole repo' };
  }
  if (!isObj(htmlScan) || !isArr(htmlScan.refs) || !Number.isInteger(htmlScan.dynamic) || htmlScan.dynamic < 0) {
    return { ok: true, shape: 'multi', file: null, license, why: 'the page was never read for its references — unverified means fork, not download' };
  }
  if (htmlScan.dynamic > 0) {
    return { ok: true, shape: 'multi', file: null, license, why: `the page makes ${htmlScan.dynamic} load${htmlScan.dynamic === 1 ? '' : 's'} it computes at runtime — unverifiable, so fork, not download` };
  }
  if (htmlScan.refs.length > 0) {
    return { ok: true, shape: 'multi', file: null, license, why: `index.html references ${htmlScan.refs.length} local file${htmlScan.refs.length === 1 ? '' : 's'} — the download alone would be broken` };
  }
  const others = paths.filter((p) => !isMetaFile(p) && p !== file).length;
  return {
    ok: true, shape: 'single', file, license,
    why: others > 0
      ? 'the live page is self-contained — the repo also carries its source and gate, which is what the fork is for'
      : 'one self-contained index.html — the file IS the app',
  };
}

// ── who may be minted at all ─────────────────────────────────────────────────────────────────────
/**
 * mintDecision(row, shapeInfo) — row: a catalogue row ({name, tier, ...}). shapeInfo: the shape
 * record for that repo (from classifyShape / mint-data.json), or null/undefined when the repo was
 * never shape-scanned. Returns { kind: 'download' | 'fork' | 'none', why }.
 * The tier is re-checked HERE, not trusted from a flag: only proven/works may ever carry a mint.
 */
export function mintDecision(row, shapeInfo) {
  if (!isObj(row) || !isStr(row.tier)) return { kind: 'none', why: 'not a real catalogue row' };
  if (row.tier !== 'proven' && row.tier !== 'works') {
    return { kind: 'none', why: 'a prototype is named honestly, never sold' };
  }
  if (isObj(shapeInfo) && shapeInfo.shape === 'single' && isStr(shapeInfo.file) && shapeInfo.file.length > 0) {
    return { kind: 'download', file: shapeInfo.file, license: isStr(shapeInfo.license) ? shapeInfo.license : null, why: 'single-file app — download the real file and it runs' };
  }
  return { kind: 'fork', why: 'the app is its whole repo — fork it to your own GitHub account' };
}

// ── provenance ───────────────────────────────────────────────────────────────────────────────────
const SHA40 = /^[0-9a-f]{40}$/;

/**
 * provenanceNote(p) — the re-runnable proof pointer every minted bundle carries.
 * Required: name, tier (proven|works ONLY), why, sha (40-hex), mintedAt, generatedAt.
 * Optional: runUrl (https CI run), workflow, licenseNote, branch.
 */
export function provenanceNote(p) {
  if (!isObj(p)) return { ok: false, why: 'provenance needs a record' };
  if (!isStr(p.name) || !/^[a-z0-9._-]+$/i.test(p.name)) return { ok: false, why: 'not a real repo name' };
  if (p.tier !== 'proven' && p.tier !== 'works') return { ok: false, why: 'provenance is never written for an unproven app' };
  if (!isStr(p.sha) || !SHA40.test(p.sha)) return { ok: false, why: 'the pinned SHA must be the full 40-hex commit' };
  if (!isStr(p.mintedAt) || p.mintedAt.length === 0) return { ok: false, why: 'mintedAt missing' };
  if (!isStr(p.generatedAt) || p.generatedAt.length === 0) return { ok: false, why: 'generatedAt missing' };
  if (p.runUrl !== undefined && p.runUrl !== null && !(isStr(p.runUrl) && p.runUrl.startsWith('https://'))) {
    return { ok: false, why: 'a CI run URL must be https' };
  }
  const repoUrl = `https://github.com/sjgant80-hub/${p.name}`;
  const lines = [
    `PROVENANCE — ${p.name}`,
    ``,
    `minted:   ${p.mintedAt}`,
    `source:   ${repoUrl}`,
    `pinned:   ${p.sha}`,
    `tier:     ${p.tier.toUpperCase()} — ${isStr(p.why) ? p.why : 'computed from GitHub\'s own CI record'}`,
    `evidence: tier data generated ${p.generatedAt}, computed from GitHub's own CI record for this`,
    `          repo — never typed, never a claim the repo made about itself.`,
  ];
  if (isStr(p.runUrl) && p.runUrl.startsWith('https://')) {
    lines.push(`ci run:   ${p.runUrl}${isStr(p.workflow) && p.workflow ? ` (${p.workflow})` : ''}`);
  } else {
    lines.push(`ci run:   ${repoUrl}/actions (the repo's own Actions record)`);
  }
  lines.push(
    ``,
    `VERIFY BEFORE YOU RELY — all three re-runnable by you or your agent:`,
    `  1. the proof:  open the ci run URL above — that is GitHub's own record of what ran`,
    `     on GitHub's own hardware, not this page's claim.`,
    `  2. the bytes:  this exact file is pinned at`,
    `     https://raw.githubusercontent.com/sjgant80-hub/${p.name}/${p.sha}/index.html`,
    `     — fetch it and diff against your copy.`,
    `  3. the tier law: https://github.com/sjgant80-hub/mint-an-app (tier.mjs — there is no setter).`,
    ``,
    isStr(p.licenseNote) && p.licenseNote.length > 0
      ? `licence:  ${p.licenseNote}`
      : `licence:  see the LICENSE file in this bundle.`,
    ``,
    `Minted from the estate's catalogue (https://sjgant80-hub.github.io/mint-an-app/).`,
    `No subscription, no account, no phone-home: this copy is yours.`,
    `Powered by the Konomi architecture, created by Thomas Frumkin.`,
  );
  return { ok: true, text: lines.join('\n') + '\n' };
}

// ── crc32 ────────────────────────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  if (!(bytes instanceof Uint8Array)) return null;
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── the bundle ───────────────────────────────────────────────────────────────────────────────────
// STORE-method zip (no compression — these are already-small text files, and STORE keeps the writer
// small enough to gate properly). Fixed DOS timestamp 1980-01-01 00:00 so the same entries always
// produce the same bytes: a deterministic bundle is a diffable bundle.
const DOS_TIME = 0, DOS_DATE = 0x21;

const enc = new TextEncoder();
const toBytes = (d) => (d instanceof Uint8Array) ? d : (isStr(d) ? enc.encode(d) : null);

function le16(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF); }
function le32(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); }

export function storeZip(entries) {
  if (!isArr(entries) || entries.length === 0) return { ok: false, why: 'a bundle needs at least one entry' };
  const seen = new Set();
  const parts = [];      // locals as byte arrays
  const central = [];    // central-directory records
  let offset = 0;
  for (const e of entries) {
    if (!isObj(e) || !isStr(e.name)) return { ok: false, why: 'every entry needs a name and data' };
    const name = e.name;
    if (name.length === 0 || name.length > 512 || name.includes('\\') || name.startsWith('/')
      || name.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
      return { ok: false, why: `"${name.slice(0, 60)}" is not a safe archive path` };
    }
    if (seen.has(name)) return { ok: false, why: `duplicate entry "${name}"` };
    seen.add(name);
    const data = toBytes(e.data);
    if (data === null) return { ok: false, why: `entry "${name}" has no usable data` };
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = [];
    le32(local, 0x04034b50); le16(local, 20); le16(local, 0x0800); le16(local, 0);
    le16(local, DOS_TIME); le16(local, DOS_DATE);
    le32(local, crc); le32(local, data.length); le32(local, data.length);
    le16(local, nameBytes.length); le16(local, 0);
    const localBytes = new Uint8Array(local.length + nameBytes.length + data.length);
    localBytes.set(local, 0); localBytes.set(nameBytes, local.length); localBytes.set(data, local.length + nameBytes.length);
    central.push({ nameBytes, crc, size: data.length, offset });
    parts.push(localBytes);
    offset += localBytes.length;
  }
  const cd = [];
  for (const c of central) {
    le32(cd, 0x02014b50); le16(cd, 20); le16(cd, 20); le16(cd, 0x0800); le16(cd, 0);
    le16(cd, DOS_TIME); le16(cd, DOS_DATE);
    le32(cd, c.crc); le32(cd, c.size); le32(cd, c.size);
    le16(cd, c.nameBytes.length); le16(cd, 0); le16(cd, 0); le16(cd, 0); le16(cd, 0);
    le32(cd, 0); le32(cd, c.offset);
    for (const b of c.nameBytes) cd.push(b);
  }
  const eocd = [];
  le32(eocd, 0x06054b50); le16(eocd, 0); le16(eocd, 0);
  le16(eocd, central.length); le16(eocd, central.length);
  le32(eocd, cd.length); le32(eocd, offset); le16(eocd, 0);
  const total = offset + cd.length + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  out.set(cd, pos); pos += cd.length;
  out.set(eocd, pos);
  return { ok: true, bytes: out };
}

export default { isMetaFile, isLocalRef, localRefs, classifyShape, mintDecision, provenanceNote, crc32, storeZip };
