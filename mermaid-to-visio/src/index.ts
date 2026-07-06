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
 * mermaid-to-visio — convert Mermaid diagrams to native Microsoft Visio (.vsdx).
 *
 * A companion library for Mermaid. Mermaid renders a diagram to SVG exactly as
 * normal; this library walks that rendered SVG and reproduces *every* primitive
 * (rect, text, path, line, polygon, circle) as a native Visio shape at the same
 * coordinates. It is diagram-type-agnostic — there is no per-diagram logic.
 *
 * Two entry points:
 *   • svgElementToVsdx(svgEl, opts) — convert an already-rendered SVG element.
 *   • renderToVisio(mermaid, id, def, opts) — render a Mermaid definition and
 *     convert it, using a caller-supplied Mermaid instance (kept as an optional
 *     peer so this library never bundles or pins Mermaid).
 *
 * Both require a DOM: Mermaid measures text with getBBox/getCTM/getComputedStyle,
 * which resolve only for an element laid out in the document. Use this in a
 * browser, or under a headless browser (e.g. Puppeteer) — not bare Node/jsdom.
 */

import { captureSvgToDisplayList } from './svgCapture.js';
import { buildVsdxFromDisplayList } from './vsdxBuilder.js';
import type { VisioBuildOptions, VisioBuildResult } from './vsdxBuilder.js';

// Low-level building blocks (for advanced use).
export { captureSvgToDisplayList } from './svgCapture.js';
export { buildVsdxFromDisplayList } from './vsdxBuilder.js';
export type { VisioBuildOptions, VisioBuildResult } from './vsdxBuilder.js';
export type { DisplayList, DisplayItem, PolyItem, TextItem } from './displayList.js';
export { normalizeColor } from './colors.js';
export { CoordinateSpace, boundsOf } from './coordinates.js';

/**
 * Convert an already-rendered, DOM-attached SVG element into a native Visio
 * (.vsdx) package. No Mermaid dependency — works on any SVG.
 *
 * @param svg - An <svg> element attached to the document.
 * @param options - Visio build options (e.g. document title).
 */
export function svgElementToVsdx(
  svg: SVGSVGElement,
  options: VisioBuildOptions = {}
): VisioBuildResult {
  return buildVsdxFromDisplayList(captureSvgToDisplayList(svg), options);
}

/** The minimal slice of the Mermaid API this library uses. */
export interface MermaidRenderer {
  render(
    id: string,
    text: string,
    container?: Element
  ): Promise<{ svg: string; bindFunctions?: (el: Element) => void }>;
}

/**
 * Render a Mermaid definition straight to a native Visio (.vsdx) package.
 *
 * The Mermaid instance is passed in (not imported) so this library stays
 * version-agnostic and adds no hard dependency:
 *
 * ```ts
 * import mermaid from 'mermaid';
 * import { renderToVisio } from 'mermaid-to-visio';
 * const { bytes } = await renderToVisio(mermaid, 'id', 'flowchart TD\n A-->B');
 * ```
 *
 * @param mermaid - A Mermaid instance exposing `render(id, text)`.
 * @param id - A unique id for the temporary SVG element.
 * @param definition - The Mermaid diagram source.
 * @param options - Visio build options (e.g. document title).
 */
export async function renderToVisio(
  mermaid: MermaidRenderer,
  id: string,
  definition: string,
  options: VisioBuildOptions = {}
): Promise<VisioBuildResult> {
  if (typeof document === 'undefined') {
    throw new Error(
      'renderToVisio requires a DOM environment (browser or headless browser).'
    );
  }

  const { svg } = await mermaid.render(id, definition);

  // Re-attach the rendered SVG so getBBox / getCTM / getComputedStyle resolve
  // (they require the element to be laid out in the document). The embedded
  // <style> travels with the SVG string, so theme/class colours resolve too.
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'absolute';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.innerHTML = svg;
  document.body.appendChild(host);
  try {
    const svgEl = host.querySelector('svg');
    if (!svgEl) {
      throw new Error('Mermaid did not produce an SVG element to export.');
    }
    return svgElementToVsdx(svgEl as SVGSVGElement, options);
  } finally {
    host.remove();
  }
}
