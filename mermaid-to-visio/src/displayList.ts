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
 * A backend-agnostic "display list": the flat set of visual primitives that
 * Mermaid actually drew, in absolute SVG-pixel coordinates.
 *
 * This is the universal hand-off point. Whatever the diagram type, Mermaid
 * ultimately paints the same small vocabulary of SVG primitives; we capture
 * those (see svgCapture.ts) and reproduce each one as a native Visio shape (see
 * vsdxBuilder.ts). No diagram-type logic exists on either side — if Mermaid drew
 * it, it is in this list.
 */

import type { PixelPoint } from './coordinates.js';

/** A filled/stroked outline: rectangles, polygons, lines, paths, circles — all
 * reduced to an absolute-coordinate poly-line (curves sampled to segments). */
export interface PolyItem {
  kind: 'poly';
  points: PixelPoint[];
  closed: boolean;
  fill?: string;
  stroke?: string;
  strokeWidthPx: number;
  dash: boolean;
}

/** A run of text positioned by its rendered bounding box (absolute pixels). */
export interface TextItem {
  kind: 'text';
  text: string;
  /** Top-left of the text's rendered bounding box. */
  x: number;
  y: number;
  width: number;
  height: number;
  fontPx: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  /** SVG text-anchor: start | middle | end. */
  anchor: 'start' | 'middle' | 'end';
  fill: string;
}

export type DisplayItem = PolyItem | TextItem;

export interface DisplayList {
  /** Page width in pixels (from the SVG viewBox or content bounds). */
  width: number;
  /** Page height in pixels. */
  height: number;
  /** Primitives in paint order (first = bottom of the z-stack). */
  items: DisplayItem[];
}
