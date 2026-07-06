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
// vendor-extension.mjs — refresh the built Visio-export extension across the repo
// from the sibling source build (../mermaid-to-visio/dist/index.js).
//
// This project ships ONLY the extension — never a copy of Mermaid. Mermaid is the
// official public engine, loaded from the CDN (or self-hosted for offline use;
// see scripts/fetch-mermaid.mjs and docs/USER-GUIDE.md).
//
//   node scripts/vendor-extension.mjs
//
// Run after `npm --prefix ../mermaid-to-visio run build`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..'); // visio-as-script
const REPO = path.resolve(PROJECT, '..'); // repo root

const SRC = path.resolve(PROJECT, '../mermaid-to-visio/dist/index.js');
if (!fs.existsSync(SRC)) {
  console.error(
    'Extension build not found at:\n  ' +
      SRC +
      '\nBuild it first:  (cd ../mermaid-to-visio && npm install && npm run build)'
  );
  process.exit(1);
}

// Every place that serves or ships the extension, kept in sync from one source.
const TARGETS = [
  path.join(PROJECT, 'vendor', 'mermaid-to-visio', 'index.js'),
  path.join(REPO, 'visio-as-script-web', 'mermaid-to-visio', 'index.js'),
  path.join(REPO, 'packages', 'mermaid-to-visio', 'dist', 'index.js'),
];

for (const dest of TARGETS) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(SRC, dest);
  console.log('  vendored →', path.relative(REPO, dest));
}
console.log(`Done. Extension is ${(fs.statSync(SRC).size / 1024).toFixed(1)} KB.`);
