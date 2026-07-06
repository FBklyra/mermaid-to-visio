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
// fetch-mermaid.mjs — OPTIONAL. Self-host the OFFICIAL Mermaid engine for offline
// or air-gapped/intranet use, so the app does not depend on the public CDN.
//
// This project deliberately does NOT bundle Mermaid. This script copies the
// official Mermaid you installed from npm into ./public/mermaid (git-ignored), and
// the Node server then serves it at /mermaid/*. You must also point the import map
// in public/index.html at the local path (see docs/USER-GUIDE.md).
//
//   npm install mermaid           # get the official engine from the public registry
//   node scripts/fetch-mermaid.mjs
//
// Nothing here is committed — public/mermaid/ is in .gitignore.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');

// Locate the official Mermaid dist installed via npm.
const candidates = [
  process.env.MERMAID_DIST,
  path.join(PROJECT, 'node_modules', 'mermaid', 'dist'),
  path.resolve(PROJECT, '..', 'node_modules', 'mermaid', 'dist'),
].filter(Boolean);

const dist = candidates.find((d) => fs.existsSync(path.join(d, 'mermaid.esm.min.mjs')));
if (!dist) {
  console.error(
    'Official Mermaid not found. Install it from the public registry first:\n' +
      '  npm install mermaid\n' +
      'or set MERMAID_DIST to an official Mermaid dist directory.'
  );
  process.exit(1);
}

const destRoot = path.join(PROJECT, 'public', 'mermaid');
fs.rmSync(destRoot, { recursive: true, force: true });

let count = 0;
let bytes = 0;
const copyTree = (src, dest) => {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else if (entry.name.endsWith('.mjs')) {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      count++;
      bytes += fs.statSync(s).size;
    }
  }
};
copyTree(dist, destRoot);

// Record which official version was copied, for traceability.
let version = 'unknown';
try {
  version = JSON.parse(
    fs.readFileSync(path.resolve(dist, '..', 'package.json'), 'utf8')
  ).version;
} catch {}

console.log(`Self-hosted OFFICIAL Mermaid v${version} from:\n  ${dist}`);
console.log(`  → ${path.relative(PROJECT, destRoot)}  (${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB)`);
console.log(
  '\nNext: in public/index.html, set the import map "mermaid" entry to\n' +
    '  "/mermaid/mermaid.esm.min.mjs"\n' +
    'so the app uses your self-hosted copy instead of the CDN.'
);
