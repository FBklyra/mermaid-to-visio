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
import { describe, it, expect } from 'vitest';
import { buildVsdxFromDisplayList } from '../src/vsdxBuilder.js';
import type { DisplayList } from '../src/displayList.js';
import { CoordinateSpace, boundsOf } from '../src/coordinates.js';
import { normalizeColor } from '../src/colors.js';
import { createZip } from '../src/zipStore.js';

/** STORE-method zip keeps XML uncompressed, so we can read parts straight back. */
const asText = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

const sampleList = (): DisplayList => ({
  width: 200,
  height: 120,
  items: [
    // a filled box
    {
      kind: 'poly',
      points: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 50 },
        { x: 10, y: 50 },
      ],
      closed: true,
      fill: '#DBEAFE',
      stroke: '#1E3A8A',
      strokeWidthPx: 1,
      dash: false,
    },
    // a connector line
    {
      kind: 'poly',
      points: [
        { x: 50, y: 50 },
        { x: 50, y: 90 },
      ],
      closed: false,
      stroke: '#333333',
      strokeWidthPx: 1.5,
      dash: false,
    },
    // a text run (attribute row content)
    {
      kind: 'text',
      text: 'geo_key PK',
      x: 14,
      y: 14,
      width: 60,
      height: 14,
      fontPx: 14,
      fontFamily: 'Helvetica',
      bold: true,
      italic: false,
      anchor: 'start',
      fill: '#000000',
    },
  ],
});

describe('CoordinateSpace', () => {
  it('flips Y and converts px→inches', () => {
    const space = new CoordinateSpace({ minX: 0, minY: 0, maxX: 96, maxY: 192 }, 0);
    expect(space.pageWidthIn).toBeCloseTo(1, 5);
    expect(space.pageHeightIn).toBeCloseTo(2, 5);
    expect(space.point({ x: 0, y: 0 })).toEqual({ x: 0, y: 2 });
    expect(space.point({ x: 96, y: 192 })).toEqual({ x: 1, y: 0 });
  });
});

describe('boundsOf', () => {
  it('encloses all points', () => {
    expect(boundsOf([{ x: 1, y: 2 }, { x: 5, y: -3 }])).toEqual({ minX: 1, minY: -3, maxX: 5, maxY: 2 });
  });
});

describe('normalizeColor', () => {
  it('handles hex, short hex, rgb and transparent', () => {
    expect(normalizeColor('#abcdef')).toBe('#ABCDEF');
    expect(normalizeColor('#f00')).toBe('#FF0000');
    expect(normalizeColor('rgb(51,51,51)')).toBe('#333333');
    expect(normalizeColor('rgba(0,0,0,0)')).toBeUndefined();
    expect(normalizeColor('none')).toBeUndefined();
  });
});

describe('createZip', () => {
  it('writes a PK signature and round-trips stored content', () => {
    const bytes = createZip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }]);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(asText(bytes)).toContain('hello');
  });
});

describe('buildVsdxFromDisplayList', () => {
  it('emits a shape per poly and per text run, with valid OPC skeleton', () => {
    const { bytes, stats } = buildVsdxFromDisplayList(sampleList(), { title: 'unit' });
    expect(stats.shapes).toBe(2);
    expect(stats.texts).toBe(1);

    const text = asText(bytes);
    expect(text).toContain('[Content_Types].xml');
    expect(text).toContain('visio/pages/page1.xml');
    expect(text).toContain('application/vnd.ms-visio.drawing.main+xml');
    expect(text).toContain('<Shapes>');
    // box fill + stroke present
    expect(text).toContain('N="FillForegnd" V="#DBEAFE"');
    expect(text).toContain('N="LineColor" V="#1E3A8A"');
    // text content reproduced (this is the box content that was previously missing)
    expect(text).toContain('<Text>geo_key PK</Text>');
    // bold style bit set
    expect(text).toContain('N="Style" V="1"');
  });

  it('reproduces EVERY drawn primitive (no filtering by kind)', () => {
    const many: DisplayList = {
      width: 100,
      height: 100,
      items: Array.from({ length: 25 }, (_, i) => ({
        kind: 'text' as const,
        text: `row ${i}`,
        x: 0,
        y: i * 4,
        width: 40,
        height: 4,
        fontPx: 12,
        fontFamily: 'Arial',
        bold: false,
        italic: false,
        anchor: 'start' as const,
        fill: '#000000',
      })),
    };
    const { stats } = buildVsdxFromDisplayList(many);
    expect(stats.texts).toBe(25); // all attribute rows survive
  });

  it('skips empty text and degenerate polys', () => {
    const { stats } = buildVsdxFromDisplayList({
      width: 10,
      height: 10,
      items: [
        { kind: 'text', text: '   ', x: 0, y: 0, width: 1, height: 1, fontPx: 12, fontFamily: 'Arial', bold: false, italic: false, anchor: 'start', fill: '#000' },
        { kind: 'poly', points: [{ x: 0, y: 0 }], closed: false, stroke: '#000', strokeWidthPx: 1, dash: false },
      ],
    });
    expect(stats.shapes).toBe(0);
    expect(stats.texts).toBe(0);
  });
});
