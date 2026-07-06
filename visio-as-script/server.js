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
// visio-as-script — zero-dependency static server for the Mermaid → Visio web editor.
//
// It serves:
//   /                   → the editor UI in ./public
//   /mermaid-to-visio/* → the Visio-export extension (SVG → .vsdx)
//   /mermaid/*          → OPTIONAL: a self-hosted copy of the OFFICIAL Mermaid
//                         engine, only if you provide one (offline use). This
//                         project does NOT bundle Mermaid; by default the browser
//                         loads it from the public CDN (see public/index.html).
//
// The browser renders with the official Mermaid and exports with this extension —
// no Mermaid fork, no bundled Mermaid. No framework, no build step. `node server.js`.

import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const PUBLIC_ROOT = path.join(__dirname, 'public');

/** Resolve a directory by trying candidates in order; first that has `marker`. */
function resolveDir(candidates, marker, errorMsg) {
  const found = resolveDirOptional(candidates, marker);
  if (found) return found;
  throw new Error(errorMsg);
}

/** Like resolveDir but returns null instead of throwing when nothing matches. */
function resolveDirOptional(candidates, marker) {
  for (const dir of candidates.filter(Boolean)) {
    if (fs.existsSync(path.join(dir, marker))) return dir;
  }
  return null;
}

/**
 * OPTIONAL self-hosted OFFICIAL Mermaid engine, for offline/intranet use.
 * Mermaid is NOT bundled with this project; by default the browser loads it from
 * the public CDN (see the import map in public/index.html). If you want to serve
 * it yourself, provide a Mermaid `dist` directory via one of:
 *   1. $MERMAID_DIST            — explicit path to an official Mermaid dist
 *   2. ./public/mermaid         — drop the official engine here
 * If none exists, /mermaid/* returns 404 and the app uses the CDN.
 */
const MERMAID_ROOT = resolveDirOptional(
  [process.env.MERMAID_DIST, path.join(__dirname, 'public', 'mermaid')],
  'mermaid.esm.min.mjs'
);

/**
 * The Visio-export extension directory (this is OUR code, and must be present).
 *   1. ./vendor/mermaid-to-visio  — self-contained copy (deployment)
 *   2. sibling ../mermaid-to-visio/dist  (dev fallback)
 */
const LIBRARY_ROOT = resolveDir(
  [
    path.join(__dirname, 'vendor', 'mermaid-to-visio'),
    path.resolve(__dirname, '../mermaid-to-visio/dist'),
  ],
  'index.js',
  'Visio-export extension not found. Vendor it:  npm run vendor\n' +
    'or build it:  (cd ../mermaid-to-visio && npm install && npm run build)'
);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Safely resolve a request path within a root, blocking directory traversal. */
function safeJoin(root, rel) {
  const filePath = path.normalize(path.join(root, rel));
  if (!filePath.startsWith(root)) return null; // escaped the root
  return filePath;
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);

  if (rel.startsWith('/mermaid-to-visio/')) {
    const filePath = safeJoin(LIBRARY_ROOT, rel.slice('/mermaid-to-visio/'.length));
    if (!filePath) return res.writeHead(403).end('Forbidden');
    return serveFile(res, filePath);
  }

  if (rel.startsWith('/mermaid/')) {
    if (!MERMAID_ROOT) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(
        'Mermaid is not self-hosted here; the app loads the official Mermaid from the CDN.\n' +
          'To self-host for offline use, see docs/USER-GUIDE.md.'
      );
    }
    const filePath = safeJoin(MERMAID_ROOT, rel.slice('/mermaid/'.length));
    if (!filePath) return res.writeHead(403).end('Forbidden');
    return serveFile(res, filePath);
  }

  if (rel === '/') rel = '/index.html';
  const filePath = safeJoin(PUBLIC_ROOT, rel);
  if (!filePath) return res.writeHead(403).end('Forbidden');
  serveFile(res, filePath);
});

/**
 * Open the given URL in the default browser. Best-effort: it makes `npx
 * @klyratech/visio-editor` feel instant, and silently no-ops where there's no
 * browser (Docker, CI, SSH) or when NO_OPEN=1 is set.
 */
function openBrowser(url) {
  if (process.env.NO_OPEN === '1' || !process.stdout.isTTY) return;
  const cmd =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {
    /* no browser available — the printed URL is enough */
  }
}

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  visio-as-script  →  ${url}\n`);
  console.log(`  editor    : ${PUBLIC_ROOT}`);
  console.log(`  extension : ${LIBRARY_ROOT}`);
  console.log(`  mermaid   : ${MERMAID_ROOT || 'official CDN (not self-hosted)'}\n`);
  openBrowser(url);
});
