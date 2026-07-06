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
 * Builds a native Visio (.vsdx) package from a {@link DisplayList}.
 *
 * Pure transform — no DOM. Every poly item becomes a Visio Geometry shape and
 * every text item becomes a Visio text shape, placed at the exact coordinates
 * Mermaid rendered them. Items are emitted in list (paint) order, so the Visio
 * z-stack matches the SVG.
 */

import { CoordinateSpace, boundsOf, round, type PixelPoint } from './coordinates.js';
import type { DisplayList, PolyItem, TextItem } from './displayList.js';
import { buildVsdxPackage, escapeXml, NS_MAIN, NS_R, XML_DECL } from './opcPackage.js';

export interface VisioBuildOptions {
  title?: string;
}

export interface VisioBuildResult {
  bytes: Uint8Array;
  stats: { shapes: number; texts: number };
}

/** Minimum stroke weight in inches so hairlines remain visible in Visio. */
const MIN_LINE_WEIGHT_IN = 0.0069;

export function buildVsdxFromDisplayList(
  list: DisplayList,
  options: VisioBuildOptions = {}
): VisioBuildResult {
  const space = buildSpace(list);

  let id = 1;
  let shapes = 0;
  let texts = 0;
  const shapeXml: string[] = [];

  for (const item of list.items) {
    if (item.kind === 'poly') {
      if (item.points.length < 2) {
        continue;
      }
      shapeXml.push(polyShapeXml(id++, item, space));
      shapes++;
    } else {
      if (!item.text.trim()) {
        continue;
      }
      shapeXml.push(textShapeXml(id++, item, space));
      texts++;
    }
  }

  const pageContents = `${XML_DECL}
<PageContents xmlns="${NS_MAIN}" xmlns:r="${NS_R}" xml:space="preserve">
  <Shapes>
${shapeXml.join('\n')}
  </Shapes>
</PageContents>`;

  const bytes = buildVsdxPackage({
    pageContents,
    pageWidthIn: space.pageWidthIn,
    pageHeightIn: space.pageHeightIn,
    title: options.title ?? 'Mermaid Diagram',
  });

  return { bytes, stats: { shapes, texts } };
}

function buildSpace(list: DisplayList): CoordinateSpace {
  const pts: PixelPoint[] = [];
  for (const item of list.items) {
    if (item.kind === 'poly') {
      pts.push(...item.points);
    } else {
      pts.push({ x: item.x, y: item.y }, { x: item.x + item.width, y: item.y + item.height });
    }
  }
  // Fall back to the page extent if there were no items.
  if (pts.length === 0) {
    pts.push({ x: 0, y: 0 }, { x: list.width || 1, y: list.height || 1 });
  }
  return new CoordinateSpace(boundsOf(pts));
}

function polyShapeXml(id: number, item: PolyItem, space: CoordinateSpace): string {
  // Convert every point into absolute Visio inches (Y already flipped).
  const inch = item.points.map((p) => space.point(p));
  const xs = inch.map((p) => p.x);
  const ys = inch.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 0.001);
  const height = Math.max(maxY - minY, 0.001);

  const hasFill = !!item.fill;
  const hasLine = !!item.stroke;

  const rows: string[] = [];
  inch.forEach((p, i) => {
    const lx = round(p.x - minX);
    const ly = round(p.y - minY);
    rows.push(
      `        <Row T="${i === 0 ? 'MoveTo' : 'LineTo'}" IX="${i + 1}"><Cell N="X" V="${lx}"/><Cell N="Y" V="${ly}"/></Row>`
    );
  });
  if (item.closed && inch.length > 1) {
    rows.push(
      `        <Row T="LineTo" IX="${inch.length + 1}"><Cell N="X" V="${round(
        inch[0].x - minX
      )}"/><Cell N="Y" V="${round(inch[0].y - minY)}"/></Row>`
    );
  }

  const cells = [
    cell('PinX', round((minX + maxX) / 2)),
    cell('PinY', round((minY + maxY) / 2)),
    cell('Width', round(width)),
    cell('Height', round(height)),
    cell('LocPinX', round(width / 2)),
    cell('LocPinY', round(height / 2)),
    cell('Angle', 0),
    ...(hasFill
      ? [strCell('FillForegnd', item.fill!), cell('FillPattern', 1)]
      : [cell('FillPattern', 0)]),
    ...(hasLine
      ? [
          strCell('LineColor', item.stroke!),
          cell('LineWeight', round(Math.max(space.length(item.strokeWidthPx), MIN_LINE_WEIGHT_IN))),
          cell('LinePattern', item.dash ? 2 : 1),
        ]
      : [cell('LinePattern', 0)]),
  ];

  return [
    `    <Shape ID="${id}" Type="Shape">`,
    `      ${cells.join('')}`,
    `      <Section N="Geometry" IX="0">`,
    `        <Cell N="NoFill" V="${hasFill ? 0 : 1}"/><Cell N="NoLine" V="${hasLine ? 0 : 1}"/>`,
    rows.join('\n'),
    `      </Section>`,
    `    </Shape>`,
  ].join('\n');
}

function textShapeXml(id: number, item: TextItem, space: CoordinateSpace): string {
  const topLeft = space.point({ x: item.x, y: item.y });
  const bottomRight = space.point({ x: item.x + item.width, y: item.y + item.height });
  const width = Math.max(Math.abs(bottomRight.x - topLeft.x), 0.02);
  const height = Math.max(Math.abs(topLeft.y - bottomRight.y), 0.02);
  const pinX = (topLeft.x + bottomRight.x) / 2;
  const pinY = (topLeft.y + bottomRight.y) / 2;
  const sizeIn = round(item.fontPx / 96);
  const styleBits = (item.bold ? 1 : 0) | (item.italic ? 2 : 0);
  const horiz = item.anchor === 'middle' ? 1 : item.anchor === 'end' ? 2 : 0;

  const cells = [
    cell('PinX', round(pinX)),
    cell('PinY', round(pinY)),
    cell('Width', round(width)),
    cell('Height', round(height)),
    cell('LocPinX', round(width / 2)),
    cell('LocPinY', round(height / 2)),
    cell('Angle', 0),
    cell('FillPattern', 0),
    cell('LinePattern', 0),
    cell('VerticalAlign', 1),
    // Keep text on one line; Visio should not re-wrap our already-laid-out runs.
    cell('TextDirection', 0),
  ];

  return [
    `    <Shape ID="${id}" Type="Shape">`,
    `      ${cells.join('')}`,
    `      <Section N="Character"><Row IX="0"><Cell N="Color" V="${escapeXml(
      item.fill
    )}"/><Cell N="Size" V="${sizeIn}"/><Cell N="Style" V="${styleBits}"/></Row></Section>`,
    `      <Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="${horiz}"/></Row></Section>`,
    `      <Text>${escapeXml(item.text)}</Text>`,
    `    </Shape>`,
  ].join('\n');
}

function cell(name: string, value: number): string {
  return `<Cell N="${name}" V="${value}"/>`;
}
function strCell(name: string, value: string): string {
  return `<Cell N="${name}" V="${escapeXml(value)}"/>`;
}
