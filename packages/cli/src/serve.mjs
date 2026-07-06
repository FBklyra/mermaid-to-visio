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
// serve.mjs — HTTP endpoint for automated pipelines (a "web-API primitive").
//
// POST /render?format=vsdx|svg|png[&theme=&dpi=&title=]  body: Mermaid source
//   → responds with the rendered file bytes.
// GET  /health  → { ok: true }
//
// One headless renderer is kept warm and calls are serialized (the page is
// single-threaded). Mermaid is the official public engine (npm dependency).

import http from 'node:http';
import { createRenderer } from './renderer.mjs';

const CONTENT_TYPE = {
  vsdx: 'application/vnd.ms-visio.drawing',
  svg: 'image/svg+xml',
  png: 'image/png',
};
const EXT = { vsdx: '.vsdx', svg: '.svg', png: '.png' };

export async function startServer(flags = {}) {
  const port = Number(flags.port) || 4477;
  const host = flags.host || '127.0.0.1';

  const renderer = await createRenderer();

  // Serialize render calls (single headless page).
  let chain = Promise.resolve();
  const queue = (fn) => (chain = chain.then(fn, fn));

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${host}:${port}`);

    if (req.method === 'GET' && u.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (req.method === 'POST' && u.pathname === '/render') {
      const format = (u.searchParams.get('format') || 'vsdx').toLowerCase();
      if (!EXT[format]) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end(`unknown format "${format}". Use vsdx|svg|png.`);
      }
      const def = await readBody(req);
      if (!def.trim()) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('empty body: send Mermaid source as the request body.');
      }
      const opts = {
        theme: u.searchParams.get('theme') || undefined,
        dpi: u.searchParams.get('dpi') ? Number(u.searchParams.get('dpi')) : undefined,
        title: u.searchParams.get('title') || 'Diagram',
      };
      try {
        const { bytes } = await queue(() =>
          format === 'vsdx' ? renderer.renderVsdx(def, opts)
          : format === 'svg' ? renderer.renderSvg(def, opts)
          : renderer.renderPng(def, opts)
        );
        res.writeHead(200, {
          'Content-Type': CONTENT_TYPE[format],
          'Content-Disposition': `attachment; filename="diagram${EXT[format]}"`,
          'Content-Length': bytes.length,
        });
        return res.end(bytes);
      } catch (e) {
        res.writeHead(422, { 'Content-Type': 'text/plain' });
        return res.end('render failed: ' + (e.message || e));
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. Use POST /render?format=vsdx|svg|png  or  GET /health');
  });

  server.listen(port, host, () => {
    console.log(`\n  vas serve  →  http://${host}:${port}`);
    console.log('  POST /render?format=vsdx|svg|png   (body: Mermaid source)');
    console.log('  GET  /health\n  Ctrl+C to stop.\n');
  });

  const shutdown = async () => {
    await renderer.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
