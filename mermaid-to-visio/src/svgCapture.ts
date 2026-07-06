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
/**
 * Captures a rendered Mermaid SVG into a {@link DisplayList}.
 *
 * This is the universal, diagram-type-agnostic step: it walks the live SVG DOM
 * and records every visual primitive Mermaid drew — rectangles, text, paths,
 * lines, polygons, circles — in absolute root coordinates, reading colours from
 * the computed style (so theme/class-based fills resolve correctly). Whatever is
 * in the SVG ends up in the list; nothing is special-cased per diagram.
 *
 * Browser-only: relies on getCTM / getBBox / getComputedStyle / getPointAtLength.
 */

import type { DisplayList, DisplayItem, PolyItem, TextItem } from './displayList.js';
import type { PixelPoint } from './coordinates.js';
import { normalizeColor } from './colors.js';

/** Tags whose contents are definitions, not drawn directly. */
const SKIP_ANCESTORS = new Set(['defs', 'marker', 'clippath', 'symbol', 'pattern', 'mask']);
const MAX_PATH_SAMPLES = 600;
const CIRCLE_SAMPLES = 48;

export function captureSvgToDisplayList(svg: SVGSVGElement): DisplayList {
  // Force the SVG to lay out at its intrinsic viewBox size. Mermaid emits
  // width="100%" + max-width, so in an off-screen (zero-width) container the
  // viewBox would be scaled down to fit — and getCTM() would then return those
  // shrunken viewport coordinates, collapsing the whole drawing. Pinning the
  // width/height to the viewBox makes the viewport == user space (scale 1), so
  // getCTM yields true pixel coordinates.
  forceIntrinsicSize(svg);

  const items: DisplayItem[] = [];

  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP_ANCESTORS.has(tag)) {
      return;
    }
    if (el instanceof SVGGraphicsElement && isHidden(el)) {
      return;
    }
    if (tag === 'text') {
      collectText(el as SVGTextElement, items);
      return; // text children handled internally
    }
    const poly = polyFor(el);
    if (poly) {
      items.push(poly);
    }
    for (const child of Array.from(el.children)) {
      walk(child);
    }
  };

  for (const child of Array.from(svg.children)) {
    walk(child);
  }

  const { width, height } = pageSize(svg);
  return { width, height, items };
}

// --- geometry ---------------------------------------------------------------

function polyFor(el: Element): PolyItem | undefined {
  const tag = el.tagName.toLowerCase();
  let local: PixelPoint[] | undefined;
  let closed = false;

  switch (tag) {
    case 'rect': {
      const x = num(el, 'x');
      const y = num(el, 'y');
      const w = num(el, 'width');
      const h = num(el, 'height');
      if (w <= 0 || h <= 0) return undefined;
      local = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      closed = true;
      break;
    }
    case 'circle': {
      const cx = num(el, 'cx');
      const cy = num(el, 'cy');
      const r = num(el, 'r');
      if (r <= 0) return undefined;
      local = sampleEllipse(cx, cy, r, r);
      closed = true;
      break;
    }
    case 'ellipse': {
      const cx = num(el, 'cx');
      const cy = num(el, 'cy');
      const rx = num(el, 'rx');
      const ry = num(el, 'ry');
      if (rx <= 0 || ry <= 0) return undefined;
      local = sampleEllipse(cx, cy, rx, ry);
      closed = true;
      break;
    }
    case 'line':
      local = [
        { x: num(el, 'x1'), y: num(el, 'y1') },
        { x: num(el, 'x2'), y: num(el, 'y2') },
      ];
      break;
    case 'polyline':
    case 'polygon': {
      local = parsePoints(el.getAttribute('points'));
      closed = tag === 'polygon';
      break;
    }
    case 'path': {
      const sampled = samplePath(el as SVGPathElement);
      if (!sampled) return undefined;
      local = sampled.points;
      closed = sampled.closed;
      break;
    }
    default:
      return undefined;
  }

  if (!local || local.length < 2) {
    return undefined;
  }
  const points = simplifyCollinear(local.map((p) => toRoot(el as SVGGraphicsElement, p.x, p.y)));
  if (points.length < 2) {
    return undefined;
  }
  const style = styleOf(el);
  if (!style.fill && !style.stroke) {
    return undefined; // nothing visible
  }
  return { kind: 'poly', points, closed, ...style };
}

function sampleEllipse(cx: number, cy: number, rx: number, ry: number): PixelPoint[] {
  const pts: PixelPoint[] = [];
  for (let i = 0; i < CIRCLE_SAMPLES; i++) {
    const a = (i / CIRCLE_SAMPLES) * 2 * Math.PI;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return pts;
}

function samplePath(el: SVGPathElement): { points: PixelPoint[]; closed: boolean } | undefined {
  let total: number;
  try {
    total = el.getTotalLength();
  } catch {
    return undefined;
  }
  if (!total || !isFinite(total)) {
    return undefined;
  }
  const step = Math.max(1.5, total / MAX_PATH_SAMPLES);
  const pts: PixelPoint[] = [];
  for (let d = 0; d <= total; d += step) {
    const p = el.getPointAtLength(d);
    pts.push({ x: p.x, y: p.y });
  }
  const d = (el.getAttribute('d') ?? '').trim();
  return { points: pts, closed: /z\s*$/i.test(d) };
}

function parsePoints(raw: string | null): PixelPoint[] {
  if (!raw) return [];
  const nums = raw.trim().split(/[\s,]+/).map(Number);
  const pts: PixelPoint[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts;
}

/**
 * Drop interior points that lie (within tolerance) on the straight segment
 * between their neighbours. Collapses densely-sampled straight paths (ER divider
 * lines, orthogonal edges) to a handful of points, shrinking the output by
 * orders of magnitude while leaving genuinely curved paths well-approximated.
 */
function simplifyCollinear(points: PixelPoint[], tolerancePx = 0.35): PixelPoint[] {
  if (points.length <= 2) {
    return points;
  }
  const out: PixelPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular distance of b from line a→c.
    const dist = Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx) / len;
    if (dist > tolerancePx) {
      out.push(b);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Map a point from an element's local space to the root SVG space. */
function toRoot(el: SVGGraphicsElement, x: number, y: number): PixelPoint {
  const ctm = el.getCTM();
  if (!ctm) {
    return { x, y };
  }
  return { x: ctm.a * x + ctm.c * y + ctm.e, y: ctm.b * x + ctm.d * y + ctm.f };
}

// --- text -------------------------------------------------------------------

function collectText(textEl: SVGTextElement, items: DisplayItem[]): void {
  if (isHidden(textEl)) {
    return;
  }
  // Treat each direct child tspan that begins a line (has its own x) as a line,
  // so multi-line / wrapped text keeps its breaks. Fall back to the whole <text>.
  const lineTspans = Array.from(textEl.children).filter(
    (c) => c.tagName.toLowerCase() === 'tspan' && c.hasAttribute('x')
  ) as SVGTSpanElement[];

  if (lineTspans.length >= 2) {
    for (const line of lineTspans) {
      pushText(line, line.textContent ?? '', items);
    }
  } else {
    pushText(textEl, textEl.textContent ?? '', items);
  }
}

function pushText(el: SVGGraphicsElement, raw: string, items: DisplayItem[]): void {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) {
    return;
  }
  let bbox: DOMRect;
  try {
    bbox = el.getBBox();
  } catch {
    return;
  }
  if (bbox.width === 0 && bbox.height === 0) {
    return;
  }
  // Transform the bbox corners to root space and take the axis-aligned bounds.
  const corners = [
    toRoot(el, bbox.x, bbox.y),
    toRoot(el, bbox.x + bbox.width, bbox.y),
    toRoot(el, bbox.x + bbox.width, bbox.y + bbox.height),
    toRoot(el, bbox.x, bbox.y + bbox.height),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;

  const style = textStyleOf(el);
  items.push({ kind: 'text', text, x, y, width, height, ...style });
}

function textStyleOf(el: Element): Omit<TextItem, 'kind' | 'text' | 'x' | 'y' | 'width' | 'height'> {
  const cs = getComputedStyle(el as Element);
  // Inner tspans (e.g. PK/FK keys) may carry the actual weight/style/colour.
  const leaf = deepestTextNodeHost(el) ?? el;
  const leafCs = getComputedStyle(leaf as Element);
  const weight = leafCs.fontWeight || cs.fontWeight;
  return {
    fontPx: parseFloat(cs.fontSize) || 12,
    fontFamily: (cs.fontFamily || 'Arial').split(',')[0].replace(/["']/g, '').trim(),
    bold: weight === 'bold' || parseInt(weight, 10) >= 600,
    italic: (leafCs.fontStyle || cs.fontStyle) === 'italic',
    anchor: normalizeAnchor(cs.textAnchor),
    fill: normalizeColor(leafCs.fill) ?? normalizeColor(cs.fill) ?? '#000000',
  };
}

function deepestTextNodeHost(el: Element): Element | undefined {
  let cur: Element | undefined = el;
  while (cur) {
    const childEl: Element | undefined = Array.from(cur.children).find(
      (c) => c.tagName.toLowerCase() === 'tspan'
    );
    if (!childEl) break;
    cur = childEl;
  }
  return cur === el ? undefined : cur;
}

function normalizeAnchor(value: string | null): 'start' | 'middle' | 'end' {
  return value === 'middle' ? 'middle' : value === 'end' ? 'end' : 'start';
}

// --- style & helpers --------------------------------------------------------

function styleOf(el: Element): Pick<PolyItem, 'fill' | 'stroke' | 'strokeWidthPx' | 'dash'> {
  const cs = getComputedStyle(el);
  return {
    fill: normalizeColor(cs.fill),
    stroke: normalizeColor(cs.stroke),
    strokeWidthPx: parseFloat(cs.strokeWidth) || 1,
    dash: !!cs.strokeDasharray && cs.strokeDasharray !== 'none' && cs.strokeDasharray !== '0',
  };
}

function isHidden(el: SVGGraphicsElement): boolean {
  const cs = getComputedStyle(el);
  return cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0;
}

function num(el: Element, attr: string): number {
  return parseFloat(el.getAttribute(attr) ?? '0') || 0;
}

/** Pin the SVG to its viewBox pixel size so the viewport is not scaled. */
function forceIntrinsicSize(svg: SVGSVGElement): void {
  const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  let w = 0;
  let h = 0;
  if (vb.length === 4) {
    w = vb[2];
    h = vb[3];
  } else {
    try {
      const b = svg.getBBox();
      w = b.width;
      h = b.height;
    } catch {
      /* no-op */
    }
  }
  if (w > 0 && h > 0) {
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.style.maxWidth = 'none';
    svg.style.width = `${w}px`;
    svg.style.height = `${h}px`;
  }
}

function pageSize(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const p = vb.split(/[\s,]+/).map(Number);
    if (p.length === 4) {
      return { width: p[2], height: p[3] };
    }
  }
  try {
    const b = svg.getBBox();
    return { width: b.width, height: b.height };
  } catch {
    return { width: 0, height: 0 };
  }
}
