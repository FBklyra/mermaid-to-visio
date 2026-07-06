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
// renderer.mjs — headless rendering core shared by the CLI and the HTTP server.
//
// Mermaid is the OFFICIAL public engine, resolved from node_modules (a normal npm
// dependency). This package ships NO copy of Mermaid. We serve the official
// Mermaid dist and our extension over an ephemeral localhost server and drive a
// headless Chromium page that uses the SAME import map as the web app — so the
// CLI output matches the browser output exactly.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

const require = createRequire(import.meta.url);

/** Locate the official Mermaid dist directory (the npm dependency). */
function mermaidDistDir() {
  const pkg = require.resolve('mermaid/package.json');
  const dir = path.join(path.dirname(pkg), 'dist');
  if (!fs.existsSync(path.join(dir, 'mermaid.esm.min.mjs'))) {
    throw new Error(
      'Official Mermaid not found. Install it:  npm install mermaid\n' +
        '(This tool uses the official public Mermaid; it bundles no copy of it.)'
    );
  }
  return dir;
}

/** Locate the built extension (this repo's @klyratech/mermaid-to-visio). */
function extensionFile() {
  try {
    return require.resolve('@klyratech/mermaid-to-visio');
  } catch {
    // Monorepo fallback: sibling package dist.
    const local = path.resolve(import.meta.dirname, '../../mermaid-to-visio/dist/index.js');
    if (fs.existsSync(local)) return local;
    throw new Error('@klyratech/mermaid-to-visio not found. Run `npm install` in the workspace.');
  }
}

const MIME = {
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">
{ "imports": {
    "mermaid": "/mermaid/mermaid.esm.min.mjs",
    "mermaid-to-visio": "/mermaid-to-visio/index.js"
} }
</script>
<script type="module">
  import mermaid from 'mermaid';
  import { renderToVisio } from 'mermaid-to-visio';

  const cfg = (theme) => ({
    startOnLoad: false, securityLevel: 'loose', theme: theme || 'default',
    htmlLabels: false, flowchart: { htmlLabels: false },
  });
  const id = () => 'vas-' + Math.random().toString(36).slice(2);
  const toB64 = (u8) => {
    let s = ''; const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    return btoa(s);
  };

  window.renderVsdx = async (def, opts = {}) => {
    mermaid.initialize(cfg(opts.theme));
    const { bytes, stats } = await renderToVisio(mermaid, id(), def, { title: opts.title });
    return { b64: toB64(bytes), stats };
  };
  window.renderSvg = async (def, opts = {}) => {
    mermaid.initialize(cfg(opts.theme));
    const { svg } = await mermaid.render(id(), def);
    return svg;
  };
  window.renderPng = async (def, opts = {}) => {
    mermaid.initialize(cfg(opts.theme));
    const { svg } = await mermaid.render(id(), def);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    const vb = (doc.getAttribute('viewBox') || '').split(/[\\s,]+/).map(Number);
    let w = vb.length === 4 ? vb[2] : parseFloat(doc.getAttribute('width')) || 800;
    let h = vb.length === 4 ? vb[3] : parseFloat(doc.getAttribute('height')) || 600;
    const scale = (opts.dpi || 720) / 96;
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('rasterize failed')); img.src = url; });
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return c.toDataURL('image/png').split(',')[1];
  };
  window.__ready = true;
</script></head><body></body></html>`;

/**
 * Create a reusable headless renderer. Call .close() when done.
 * Returns { renderVsdx, renderSvg, renderPng } where each takes (definition, opts).
 */
export async function createRenderer() {
  const mermaidDir = mermaidDistDir();
  const extFile = extensionFile();

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const send = (file) => {
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    };
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      return res.end(PAGE_HTML);
    }
    if (url.startsWith('/mermaid-to-visio/')) return send(extFile);
    if (url.startsWith('/mermaid/')) {
      const rel = url.slice('/mermaid/'.length);
      const file = path.normalize(path.join(mermaidDir, rel));
      if (!file.startsWith(mermaidDir)) { res.writeHead(403).end('Forbidden'); return; }
      return send(file);
    }
    res.writeHead(404).end('Not found');
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 30000 }).catch(() => {
    throw new Error('Renderer failed to initialize. ' + (errors[0] || ''));
  });

  const close = async () => {
    await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  };

  return {
    async renderVsdx(def, opts = {}) {
      const { b64, stats } = await page.evaluate((d, o) => window.renderVsdx(d, o), def, opts);
      return { bytes: Buffer.from(b64, 'base64'), stats };
    },
    async renderSvg(def, opts = {}) {
      const svg = await page.evaluate((d, o) => window.renderSvg(d, o), def, opts);
      return { bytes: Buffer.from(svg, 'utf8') };
    },
    async renderPng(def, opts = {}) {
      const b64 = await page.evaluate((d, o) => window.renderPng(d, o), def, opts);
      return { bytes: Buffer.from(b64, 'base64') };
    },
    close,
  };
}
