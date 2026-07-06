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
// Local test server for the STATIC `visio-as-script-web` folder.
//
// This is NOT the app's Node server — it exists only so you can open the
// static deploy folder in a browser on your laptop and confirm it works
// before handing it to infra. It serves the folder the same way IIS will:
//   - `.mjs` is served as text/javascript (the one IIS gotcha the web.config fixes)
//   - index.html is the default document
//   - files are served from the folder ROOT, so the app's absolute URLs resolve
//
// Run:  node serve-web-local.mjs        (or double-click test-web-local.cmd)
// Stop: Ctrl+C, or just close the window.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'visio-as-script-web');

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`\n  Could not find the site folder:\n    ${ROOT}\n`);
  console.error('  Make sure this script sits next to the visio-as-script-web folder.\n');
  process.exit(1);
}

// Same MIME table the IIS web.config declares. `.mjs` is the critical one.
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

function handler(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const filePath = path.resolve(ROOT, '.' + rel);
  const relCheck = path.relative(ROOT, filePath);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

// Try a few ports in case one is busy.
const PORTS = [5180, 5181, 5182, 5183, 5184];
function listen(i) {
  if (i >= PORTS.length) {
    console.error('\n  No free port found in', PORTS.join(', '), '\n');
    process.exit(1);
  }
  const port = PORTS[i];
  const server = http.createServer(handler);
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE') return listen(i + 1);
    throw e;
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n  Testing the STATIC folder:  ${ROOT}`);
    console.log(`  Open in your browser:       ${url}`);
    console.log(`\n  (Close this window or press Ctrl+C to stop.)\n`);
    // Open the default browser on Windows.
    if (process.platform === 'win32') exec(`start "" "${url}"`);
  });
}
listen(0);
