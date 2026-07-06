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
// app.js — the Visio-as-Script editor.
//
// Mermaid is the OFFICIAL public engine, resolved by the import map in index.html
// (CDN by default, or a local path for offline use). This project ships no copy
// of Mermaid — only the Visio-export extension ("mermaid-to-visio"). Because both
// the live preview and the .vsdx export run the same Mermaid build, they match.
//
// Mermaid's layout needs a real DOM (getBBox); in a browser we already have one,
// so no Puppeteer/headless Chromium is required — everything runs in this tab.

import mermaid from 'mermaid';
import { renderToVisio } from 'mermaid-to-visio';

const $ = (id) => document.getElementById(id);
const editor = $('editor');
const preview = $('preview');
const statusEl = $('status');
const statsEl = $('stats');
const themeEl = $('theme');
const dpiEl = $('dpi');
const filenameEl = $('filename');
const btnSvg = $('dl-svg');
const btnPng = $('dl-png');
const btnVsdx = $('dl-vsdx');
const btnCopy = $('copy-png');
const btnZoomIn = $('zoom-in');
const btnZoomOut = $('zoom-out');
const btnZoomReset = $('zoom-reset');
const zoomLevelEl = $('zoom-level');

const DEFAULT_DIAGRAM = `---
title: "Visio-as-Script — Architecture & Repository Boundaries"
config:
  flowchart:
    nodeSpacing: 12
    rankSpacing: 45
---
flowchart TD
    subgraph AUTHORS["Visio-as-Script · Open source, courtesy of:"]
        direction LR
        KLYRA["Klyra — klyra.tech,"]
        MYSTRATOS["MyStratos.AI — mystratos.ai"]
        REPO["GitHub — github.com/FBklyra/mermaid-to-visio"]
    end

    subgraph EXT["Mermaid Source · Upstream OSS — not in repository, pulled at build via npm / CDN"]
        direction TB
        A(["Mermaid Syntax Input"]) --> B["Parser / AST"] --> C{{"Native Renderer"}}
    end

    subgraph APP["Web Application · In Repository — editor, live preview, export"]
        direction TB
        D["Compiled Mermaid Runtime\\nBundled · downloadable · in repository"]

        subgraph STOCK["Native Rendering · Stock Capability"]
            direction TB
            E[/"SVG · PNG 720 DPI"/]
        end

        subgraph EXTENSION["VSDX Export Engine · Original Extension"]
            direction TB
            G["AST to Visio Shape / Master Mapper"] --> H[("Native .vsdx")]
        end
    end

    AUTHORS -.-> A
    C --> D
    D --> E
    D --> G

    click KLYRA "https://klyra.tech" "Klyra — klyra.tech" _blank
    click MYSTRATOS "https://mystratos.ai" "MyStratos.AI — mystratos.ai" _blank
    click REPO "https://github.com/FBklyra/mermaid-to-visio" "GitHub repository" _blank

    classDef plain fill:#f7f5ef,stroke:#f7f5ef,stroke-width:0px,color:#000000
    classDef link fill:#eef4f1,stroke:#0f6e56,color:#04342c
    classDef external fill:#f1efe8,stroke:#888780,stroke-dasharray:5 4,color:#2c2c2a
    classDef runtime fill:#e1f5ee,stroke:#0f6e56,color:#04342c
    classDef stock fill:#f1efe8,stroke:#888780,color:#2c2c2a
    classDef extension fill:#eeedfe,stroke:#534ab7,color:#26215c

    class KLYRA,MYSTRATOS plain
    class REPO link
    class A,B,C external
    class D runtime
    class E stock
    class G,H extension

    style AUTHORS fill:#f7f5ef,stroke:#b4b2a9
    style EXT fill:#faf9f5,stroke:#b4b2a9,stroke-dasharray:6 4
    style APP fill:#ffffff,stroke:#888780
    style STOCK fill:#f7f6f1,stroke:#b4b2a9
    style EXTENSION fill:#f6f5fe,stroke:#7f77dd
`;

// Match the CLI's engine config exactly so preview === export.
// htmlLabels:false keeps labels as <text> (not <foreignObject>), which the
// Visio capture reproduces faithfully.
function applyConfig() {
  mermaid.initialize({
    startOnLoad: false,
    theme: themeEl.value || 'default',
    securityLevel: 'loose',
    flowchart: { htmlLabels: false },
    htmlLabels: false,
  });
}

let renderSeq = 0; // unique id per render; also guards against stale async results
let lastGoodSource = null; // source string that produced the current preview
let lastSvg = null; // serialized SVG string of the current preview

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

function setDownloadsEnabled(on) {
  btnSvg.disabled = !on;
  btnPng.disabled = !on;
  btnVsdx.disabled = !on;
  btnCopy.disabled = !on;
  btnZoomIn.disabled = !on;
  btnZoomOut.disabled = !on;
  btnZoomReset.disabled = !on;
}

/**
 * Parse an SVG string as XML, tolerating a Mermaid quirk: `click` directives
 * emit `xlink:href` links without declaring the xlink namespace, which the
 * browser DOM accepts but a strict XML parse rejects.
 */
function parseSvg(svgString) {
  for (const text of [
    svgString,
    svgString.replace(/^<svg /, '<svg xmlns:xlink="http://www.w3.org/1999/xlink" '),
  ]) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (!doc.querySelector('parsererror')) return doc;
  }
  return null;
}

/** Read intrinsic pixel size from an SVG string (viewBox preferred). */
function svgPixelSize(svgString) {
  const doc = parseSvg(svgString);
  const svg = doc && doc.documentElement;
  const vb = svg
    ? svg.getAttribute('viewBox')
    : (svgString.match(/viewBox="([^"]*)"/) || [])[1]; // last resort: read it textually
  if (vb) {
    const [, , w, h] = vb.split(/[\s,]+/).map(Number);
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  const w = (svg && parseFloat(svg.getAttribute('width'))) || 800;
  const h = (svg && parseFloat(svg.getAttribute('height'))) || 600;
  return { width: w, height: h };
}

const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

async function render() {
  const source = editor.value;
  const seq = ++renderSeq;
  applyConfig();

  try {
    await mermaid.parse(source); // throws with a clear message on bad syntax
    const { svg } = await mermaid.render('vas-preview-' + seq, source);
    if (seq !== renderSeq) return; // a newer render superseded this one

    preview.innerHTML = svg;
    lastSvg = svg;
    lastGoodSource = source;
    setDownloadsEnabled(true);
    applyZoom(); // re-apply the current zoom to the fresh SVG
    setStatus('rendered', 'ok');

    const { width, height } = svgPixelSize(svg);
    statsEl.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
  } catch (err) {
    if (seq !== renderSeq) return;
    const msg = (err && (err.str || err.message)) || String(err);
    preview.innerHTML = `<pre class="render-error">${escapeHtml(msg)}</pre>`;
    setStatus('error', 'err');
    setDownloadsEnabled(false);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baseName() {
  return (filenameEl.value || 'diagram').trim().replace(/[\\/:*?"<>|]+/g, '_') || 'diagram';
}

// ---- preview zoom (buttons + mouse wheel over the preview) ----
// 100% = fit-to-pane (the natural first view). Zoom multiplies that fitted
// size by re-laying-out the SVG — a true vector re-render, not a scaled
// bitmap — and keeps the anchor point (button: pane center, wheel: mouse
// cursor) fixed on screen, the way a diagram editor zooms.
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;
let zoom = 1;
let panX = 0; // drag offset (px) — lets the diagram move even when it fits
let panY = 0;

function applyPan() {
  const svg = preview.querySelector('svg');
  if (svg) svg.style.transform = panX || panY ? `translate(${panX}px, ${panY}px)` : '';
}

function fittedWidth() {
  // At zoom 1 the SVG fills the pane width (Mermaid emits width="100%"),
  // so "fit" is the pane's content width — keeps the first zoom step smooth.
  const cs = getComputedStyle(preview);
  const avail = preview.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return Math.max(50, avail);
}

function applyZoom() {
  zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
  const svg = preview.querySelector('svg');
  if (!svg || !lastSvg) return;
  if (zoom === 1) {
    svg.style.width = '';
    svg.style.maxWidth = '';
    preview.style.justifyContent = ''; // back to centered fit
  } else {
    const w = fittedWidth() * zoom;
    svg.style.width = w + 'px';
    svg.style.maxWidth = 'none';
    // center while it fits; left-align once it overflows so the origin stays scrollable
    preview.style.justifyContent = w > preview.clientWidth ? 'flex-start' : '';
  }
  applyPan();
}

/** Zoom keeping the content point under (clientX, clientY) fixed on screen. */
function zoomAt(newZoom, clientX, clientY) {
  const svg = preview.querySelector('svg');
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom));
  if (!svg || !lastSvg) return;
  const before = svg.getBoundingClientRect();
  const px = clientX - before.left; // anchor, in displayed SVG pixels
  const py = clientY - before.top;
  applyZoom();
  const after = svg.getBoundingClientRect();
  const r = after.width / before.width;
  // scroll so the anchored content point lands back under the pointer/center
  preview.scrollLeft += after.left + px * r - clientX;
  preview.scrollTop += after.top + py * r - clientY;
  // absorb what the scrollbars couldn't (fitted/centered content) into the pan offset
  const rest = svg.getBoundingClientRect();
  panX -= rest.left + px * r - clientX;
  panY -= rest.top + py * r - clientY;
  applyPan();
}

function previewCenter() {
  const pr = preview.getBoundingClientRect();
  return { x: pr.left + pr.width / 2, y: pr.top + pr.height / 2 };
}

btnZoomIn.addEventListener('click', () => {
  const c = previewCenter();
  zoomAt(zoom * 1.25, c.x, c.y);
});
btnZoomOut.addEventListener('click', () => {
  const c = previewCenter();
  zoomAt(zoom / 1.25, c.x, c.y);
});
btnZoomReset.addEventListener('click', () => {
  zoom = 1;
  panX = 0;
  panY = 0;
  applyZoom();
});

// ---- drag-to-pan (hold the left mouse button and move the diagram) ----
let panning = null;

preview.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !lastSvg) return; // left button only
  panning = {
    x: e.clientX,
    y: e.clientY,
    left: preview.scrollLeft,
    top: preview.scrollTop,
    panX,
    panY,
  };
  preview.setPointerCapture(e.pointerId);
  preview.classList.add('panning');
  e.preventDefault(); // no text/SVG selection while dragging
});

preview.addEventListener('pointermove', (e) => {
  if (!panning) return;
  const dx = e.clientX - panning.x;
  const dy = e.clientY - panning.y;
  // The scrollbars absorb what they can; the transform offset takes the rest,
  // so the drag moves the diagram at ANY zoom level — even when it fully fits.
  preview.scrollLeft = panning.left - dx;
  preview.scrollTop = panning.top - dy;
  const sx = panning.left - preview.scrollLeft; // movement achieved via scroll
  const sy = panning.top - preview.scrollTop;
  panX = panning.panX + (dx - sx);
  panY = panning.panY + (dy - sy);
  applyPan();
});

const endPan = () => {
  if (!panning) return;
  panning = null;
  preview.classList.remove('panning');
};
preview.addEventListener('pointerup', endPan);
preview.addEventListener('pointercancel', endPan);

// Mouse wheel zooms while the cursor is over the preview. passive:false +
// preventDefault overrides the browser's own behavior there (scrolling and
// Ctrl+wheel page zoom).
preview.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (!lastSvg) return;
    zoomAt(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY);
  },
  { passive: false }
);

// ---- SVG (vector, resolution-independent) ----
btnSvg.addEventListener('click', () => {
  if (!lastSvg) return;
  triggerDownload(new Blob([lastSvg], { type: 'image/svg+xml' }), baseName() + '.svg');
});

// ---- PNG (rasterized at the chosen DPI; 96 DPI = CSS reference) ----
// Browsers hard-cap canvas size (Chrome ~16384 px per side, Firefox ~125M px
// total area). Past the cap, canvas.toBlob() silently yields null and nothing
// downloads — so clamp the scale up front and, if the browser still refuses,
// retry at half resolution until it succeeds.
const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_AREA = 100_000_000; // conservative cross-browser area cap

function rasterizeToPng(img, width, height, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#ffffff'; // PNG has no transparency story for diagrams; white ground
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function makePngBlob(dpi) {
  const { width, height } = svgPixelSize(lastSvg);

  let scale = Math.min(
    dpi / 96,
    MAX_CANVAS_SIDE / Math.max(width, height),
    Math.sqrt(MAX_CANVAS_AREA / (width * height))
  );

  // Mermaid emits the SVG root with width="100%" and no height; as an <img>
  // source that has no intrinsic size and rasterizes blank or tiny in some
  // browsers. Give it explicit pixel dimensions before loading.
  const doc = parseSvg(lastSvg);
  let svgText;
  if (doc) {
    const svgEl = doc.documentElement;
    svgEl.setAttribute('width', String(width));
    svgEl.setAttribute('height', String(height));
    svgEl.removeAttribute('style'); // drop max-width so the intrinsic size wins
    svgText = new XMLSerializer().serializeToString(svgEl);
  } else {
    // unparseable as XML — patch the root attributes textually
    svgText = lastSvg
      .replace(/^<svg /, '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ')
      .replace(/ width="[^"]*"/, ` width="${width}"`)
      .replace(/ style="[^"]*"/, ` height="${height}"`);
  }

  // Rasterize through an <img> loaded from the SVG, drawn onto a scaled canvas.
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not rasterize SVG'));
      img.src = url;
    });
    let blob = await rasterizeToPng(img, width, height, scale);
    while (!blob && scale > 0.51) {
      scale /= 2; // canvas limit hit anyway — back off until the browser accepts
      blob = await rasterizeToPng(img, width, height, scale);
    }
    if (!blob) throw new Error('canvas too large');
    return { blob, effDpi: Math.round(scale * 96) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

btnPng.addEventListener('click', async () => {
  if (!lastSvg) return;
  const dpi = Math.max(72, Math.min(2400, Number(dpiEl.value) || 720));
  try {
    const { blob, effDpi } = await makePngBlob(dpi);
    triggerDownload(blob, `${baseName()}@${effDpi}dpi.png`);
    setStatus(effDpi < dpi ? `PNG at ${effDpi} DPI (browser canvas limit)` : 'rendered', 'ok');
  } catch (e) {
    setStatus('PNG export failed', 'err');
  }
});

// ---- Copy (bitmap on the clipboard; paste into Word / PowerPoint / Excel / Paint) ----
btnCopy.addEventListener('click', () => {
  if (!lastSvg) return;
  if (!navigator.clipboard || !window.ClipboardItem) {
    // Clipboard API needs a secure context (HTTPS or localhost).
    setStatus('copy needs HTTPS (or localhost)', 'err');
    return;
  }
  // Cap at 300 DPI: plenty for Office pastes, and huge bitmaps can fail to copy.
  const dpi = Math.min(300, Math.max(72, Number(dpiEl.value) || 300));
  // Hand ClipboardItem a promise so the write stays inside the user gesture
  // (required by Safari).
  const pngPromise = makePngBlob(dpi).then((r) => r.blob);
  navigator.clipboard
    .write([new ClipboardItem({ 'image/png': pngPromise })])
    .then(() => setStatus('copied — paste into Word / PowerPoint / Paint', 'ok'))
    .catch(() => setStatus('copy failed', 'err'));
});

// ---- Native Visio (.vsdx) — stock Mermaid render + mermaid-to-visio export ----
btnVsdx.addEventListener('click', async () => {
  if (!lastGoodSource) return;
  setStatus('building .vsdx…');
  try {
    applyConfig();
    const { bytes, stats } = await renderToVisio(
      mermaid,
      'vas-vsdx-' + ++renderSeq,
      lastGoodSource,
      { title: baseName() }
    );
    const blob = new Blob([bytes], { type: 'application/vnd.ms-visio.drawing' });
    triggerDownload(blob, baseName() + '.vsdx');
    setStatus('rendered', 'ok');
    if (stats) statsEl.textContent = `${stats.shapes} shapes · ${stats.texts} text runs`;
  } catch (e) {
    setStatus('.vsdx export failed', 'err');
    console.error(e);
  }
});

// ---- pane splitter (drag the divider to give the editor or preview more room) ----
const splitter = $('splitter');
const panesEl = document.querySelector('.panes');
let splitting = false;

splitter.addEventListener('pointerdown', (e) => {
  splitting = true;
  splitter.setPointerCapture(e.pointerId);
  splitter.classList.add('dragging');
  e.preventDefault();
});

splitter.addEventListener('pointermove', (e) => {
  if (!splitting) return;
  const rect = panesEl.getBoundingClientRect();
  // clamp so neither pane can collapse completely
  const w = Math.min(rect.width - 260, Math.max(180, e.clientX - rect.left));
  panesEl.style.gridTemplateColumns = `${w}px 6px minmax(0, 1fr)`;
});

const endSplit = () => {
  splitting = false;
  splitter.classList.remove('dragging');
};
splitter.addEventListener('pointerup', endSplit);
splitter.addEventListener('pointercancel', endSplit);

// ---- wiring ----
const debouncedRender = debounce(render, 300);
editor.addEventListener('input', () => {
  setStatus('typing…');
  debouncedRender();
});
themeEl.addEventListener('change', render);

editor.value = DEFAULT_DIAGRAM;
render();
