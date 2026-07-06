#!/usr/bin/env node
/*!
 * Visio-as-Script — Mermaid diagrams to SVG / high-res PNG / native Visio (.vsdx).
 * Author: Freddy Beltran <freddy.beltran@klyra.tech>
 * Copyright (c) 2026 Freddy Beltran, Klyra (https://klyra.tech/),
 * and the Stratos platform (https://mystratos.ai/en/)
 * SPDX-License-Identifier: MIT
 *
 * MIT License — see the LICENSE file. Provided "AS IS", without warranty or
 * liability of any kind; the project's DISCLAIMER.md restates and expands these
 * limitations and is referenced as part of this license notice. Works with the
 * official Mermaid engine (MIT License, (c) Knut Sveidqvist and Mermaid
 * contributors); Mermaid is NOT bundled in this repository.
 */
// build-web-package.mjs — assemble a READY-TO-DEPLOY static bundle for ANY web
// server (IIS / nginx / Apache / static host), WITH the official compiled Mermaid
// included so it works out of the box and fully offline (no CDN).
//
// IMPORTANT: this produces a RELEASE ARTIFACT in ./dist (git-ignored). The git
// repository itself still ships NO copy of Mermaid. The Mermaid included here is
// the official COMPILED distribution, pulled from the npm package you installed —
// not redistributed source. Its license is included in the bundle for attribution.
//
//   npm install mermaid           # the official engine, from the public registry
//   node tools/build-web-package.mjs
//   # → dist/visio-as-script-web/      (copy this folder to your web root)
//   # → dist/visio-as-script-web.zip   (same, zipped for hand-off)
//
// Point at a specific dist with:  MERMAID_DIST=/path/to/mermaid/dist node tools/build-web-package.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'visio-as-script-web'); // the flattened static app
const OUT_DIR = path.join(REPO, 'dist', 'visio-as-script-web');
const OUT_ZIP = path.join(REPO, 'dist', 'visio-as-script-web.zip');

// ---- locate the official compiled Mermaid (from npm) ----
function findMermaid() {
  if (process.env.MERMAID_DIST) {
    const d = process.env.MERMAID_DIST;
    if (fs.existsSync(path.join(d, 'mermaid.esm.min.mjs'))) return { dist: d, root: path.resolve(d, '..') };
  }
  const require = createRequire(import.meta.url);
  for (const base of [REPO, SRC, path.join(REPO, 'visio-as-script')]) {
    try {
      const pkg = require.resolve('mermaid/package.json', { paths: [base] });
      const root = path.dirname(pkg);
      const dist = path.join(root, 'dist');
      if (fs.existsSync(path.join(dist, 'mermaid.esm.min.mjs'))) return { dist, root };
    } catch {}
  }
  return null;
}

const found = findMermaid();
if (!found) {
  console.error(
    'Official Mermaid not found. Install it from the public registry first:\n' +
      '  npm install mermaid\n' +
      'or set MERMAID_DIST to an official Mermaid dist directory.'
  );
  process.exit(1);
}
let mermaidVersion = 'unknown';
try {
  mermaidVersion = JSON.parse(fs.readFileSync(path.join(found.root, 'package.json'), 'utf8')).version;
} catch {}

// ---- helpers ----
function copyTree(src, dest, { skipDirs = [] } = {}) {
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && skipDirs.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      const r = copyTree(s, d, { skipDirs });
      files += r.files;
      bytes += r.bytes;
    } else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      files++;
      bytes += fs.statSync(s).size;
    }
  }
  return { files, bytes };
}
function copyMjs(src, dest) {
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      const r = copyMjs(s, d);
      files += r.files;
      bytes += r.bytes;
    } else if (entry.name.endsWith('.mjs')) {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      files++;
      bytes += fs.statSync(s).size;
    }
  }
  return { files, bytes };
}

// ---- 1) start from the static app (skip any stale local mermaid/) ----
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const app = copyTree(SRC, OUT_DIR, { skipDirs: ['mermaid'] });

// ---- 2) add the official compiled Mermaid at /mermaid ----
const mm = copyMjs(found.dist, path.join(OUT_DIR, 'mermaid'));
// include Mermaid's own license for attribution
for (const name of ['LICENSE', 'LICENSE.md', 'license', 'README.md']) {
  const lic = path.join(found.root, name);
  if (fs.existsSync(lic)) {
    fs.copyFileSync(lic, path.join(OUT_DIR, 'mermaid', name));
    break;
  }
}

// ---- 3) point the import map at the LOCAL Mermaid (offline, no CDN) ----
const indexPath = path.join(OUT_DIR, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(
  /"mermaid":\s*"https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid@[^"]*"/,
  '"mermaid": "/mermaid/mermaid.esm.min.mjs"'
);
fs.writeFileSync(indexPath, html);

// ---- 4) include project license/attribution at the bundle root ----
for (const f of ['LICENSE', 'NOTICE', 'DISCLAIMER.md']) {
  const src = path.join(REPO, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT_DIR, f));
}
const tpn = path.join(REPO, 'visio-as-script', 'THIRD-PARTY-NOTICES.md');
if (fs.existsSync(tpn)) fs.copyFileSync(tpn, path.join(OUT_DIR, 'THIRD-PARTY-NOTICES.md'));

// ---- 5) a short deploy note covering any web server ----
fs.writeFileSync(
  path.join(OUT_DIR, 'DEPLOY.txt'),
  `Visio-as-Script — ready-to-deploy web bundle
=============================================
Includes the official COMPILED Mermaid v${mermaidVersion} (see mermaid/LICENSE).
Works fully offline — no CDN, no Node, no build. Just serve these files.

DEPLOY
  Copy the CONTENTS of this folder to your site's web ROOT so index.html sits at
  the top level (the app uses root-absolute URLs and must be served at a site
  root, not a sub-path).

  - IIS:    web.config is included (sets the required .mjs MIME type).
  - nginx:  ensure .mjs is served as JavaScript, e.g. in a types{} block:
              types { text/javascript mjs; }
  - Apache: AddType text/javascript .mjs
  - Any static host: make sure .mjs is served with a JavaScript MIME type.

PRIVACY
  Diagrams never leave the browser. With Mermaid bundled locally there are no
  external calls at all.

Mermaid is included here as the official compiled distribution under its own MIT
license (mermaid/LICENSE). This bundle is a release artifact; the source repo
ships no copy of Mermaid.
`
);

// ---- 6) zip it (store-only, dependency-free) ----
const zipBytes = zipDir(OUT_DIR);
fs.writeFileSync(OUT_ZIP, zipBytes);

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`Built ready-to-deploy web bundle (official Mermaid v${mermaidVersion} included):`);
console.log(`  app files   : ${app.files}`);
console.log(`  mermaid     : ${mm.files} files (${mb(mm.bytes)})`);
console.log(`  → folder    : ${path.relative(REPO, OUT_DIR)}`);
console.log(`  → zip       : ${path.relative(REPO, OUT_ZIP)} (${mb(zipBytes.length)})`);
console.log('\nCopy the folder (or unzip) to your web root. Serves on any web server, offline.');

// =====================================================================
// store-only ZIP of a directory tree (same approach as tools/build-slide.mjs)
// =====================================================================
function zipDir(dir) {
  const entries = [];
  const walk = (d, prefix) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, e.name);
      const name = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(full, name);
      else entries.push({ name, data: fs.readFileSync(full) });
    }
  };
  walk(dir, '');
  return createZip(entries);
}
function createZip(entries) {
  const enc = new TextEncoder();
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (data) => {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const data = e.data;
    const crc = crc32(data);
    const size = data.length;
    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  const all = [...locals, ...centrals, eocd];
  const total = all.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of all) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}
