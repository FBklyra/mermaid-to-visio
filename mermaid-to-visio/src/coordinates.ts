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
 * Coordinate system bridge between Mermaid's SVG space and Visio's drawing space.
 *
 * Mermaid / SVG:  origin top-left, +y points DOWN, units = CSS pixels.
 * Visio:          origin bottom-left, +y points UP, internal units = INCHES.
 *
 * 1 CSS pixel = 1/96 inch (CSS reference pixel).
 *
 * The transform is a translation (so the diagram's top-left sits at the page
 * origin) plus a vertical flip. Crucially it is a pure affine map: it preserves
 * the relative position of every object, so the distribution Mermaid computed is
 * reproduced exactly in Visio — only the axis convention changes.
 */

/** Pixels-to-inches scale factor (96 CSS px per inch). */
export const PX_PER_INCH = 96;
export const PX_TO_IN = 1 / PX_PER_INCH;

export interface PixelPoint {
  x: number;
  y: number;
}

export interface InchPoint {
  x: number;
  y: number;
}

export interface PixelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Maps Mermaid SVG pixel coordinates onto Visio inch coordinates.
 *
 * Construct it once per page from the overall content bounds, then reuse it for
 * every node, edge and label so they share a single consistent frame.
 */
export class CoordinateSpace {
  /** Width of the page in inches. */
  readonly pageWidthIn: number;
  /** Height of the page in inches. */
  readonly pageHeightIn: number;

  private readonly minX: number;
  private readonly maxY: number;

  /**
   * @param bounds   Content bounding box in SVG pixels.
   * @param marginPx Uniform margin (in pixels) added around the content so the
   *                 diagram is not flush against the page edge.
   */
  constructor(bounds: PixelBounds, marginPx = 16) {
    this.minX = bounds.minX - marginPx;
    this.maxY = bounds.maxY + marginPx;
    const widthPx = bounds.maxX - bounds.minX + marginPx * 2;
    const heightPx = bounds.maxY - bounds.minY + marginPx * 2;
    this.pageWidthIn = round(widthPx * PX_TO_IN);
    this.pageHeightIn = round(heightPx * PX_TO_IN);
  }

  /** Convert an absolute SVG pixel point to an absolute Visio inch point. */
  point(p: PixelPoint): InchPoint {
    return {
      x: round((p.x - this.minX) * PX_TO_IN),
      y: round((this.maxY - p.y) * PX_TO_IN),
    };
  }

  /** Convert a pixel length (width/height/stroke) to inches (no flip). */
  length(px: number): number {
    return round(px * PX_TO_IN);
  }
}

/** Compute the pixel bounding box that encloses every supplied point. */
export function boundsOf(points: PixelPoint[]): PixelBounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Round to 6 decimal places to keep the XML compact and deterministic. */
export function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
