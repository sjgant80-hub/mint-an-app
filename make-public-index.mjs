#!/usr/bin/env node
// mint-an-app · make-public-index.mjs — regenerate estate-index-public.json from the full local
// estate index. This exists for ONE reason: the full index carries the 46 private repo names, and
// this is a PUBLIC repo, so the full index must never be committed here (see memory pages-leak-sweep).
// This strips every private node — catalogue.mjs refuses private nodes anyway, so the resulting
// catalogue is byte-identical — and keeps only { generated, nodes } so CI can rebuild deterministically.
//
// Run locally after the estate index is regenerated:  node make-public-index.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';
const idx = JSON.parse(readFileSync(SRC, 'utf8'));
const nodes = idx.nodes.filter((n) => n.private !== true);

const leaked = nodes.filter((n) => n.private === true).length;
if (leaked > 0) { console.error(`REFUSED: ${leaked} private node(s) survived the strip`); process.exit(1); }

writeFileSync('estate-index-public.json', JSON.stringify({ generated: idx.generated, nodes }));
console.log(`wrote estate-index-public.json: ${nodes.length} public nodes (${idx.nodes.length - nodes.length} private stripped)`);
