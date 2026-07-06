#!/usr/bin/env node
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
// build-slide.mjs — generate the one-slide "paradigm" PowerPoint, with zero
// dependencies, by hand-rolling the OOXML (.pptx) package and a store-only ZIP.
//
// This mirrors how the mermaid-to-visio library builds the .vsdx package: a
// hand-written OPC part tree zipped with a custom CRC32 store writer. "Office as
// script" — same philosophy as the rest of the project.
//
//   node tools/build-slide.mjs            → writes slides/architecture-from-the-conversation.pptx
//
// The slide is built from native PowerPoint shapes (no embedded image), so it is
// fully editable. For the Mermaid version of the same picture see
// docs/paradigm/paradigm-slide.mmd.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'slides');
const OUT_FILE = path.join(OUT_DIR, 'architecture-from-the-conversation.pptx');

const EMU = 914400; // per inch
const W = Math.round(13.333 * EMU); // 16:9 width
const H = Math.round(7.5 * EMU);

// ---------- tiny store-only ZIP writer (same approach as zipStore.ts) ----------
const enc = new TextEncoder();
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const data = typeof e.data === 'string' ? enc.encode(e.data) : e.data;
    const crc = crc32(data);
    const size = data.length;
    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  const all = [...locals, ...centrals, eocd];
  const total = all.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of all) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// ---------- helpers ----------
const xmlEsc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

let shapeId = 10;
/** A rounded-rectangle shape with centered, wrapped text. Geometry in EMU. */
function box(x, y, w, h, text, { fill = 'FFFFFF', line = '1A4971', text: fg = '1A2733', bold = false, size = 1400, round = true } = {}) {
  const id = shapeId++;
  return `      <p:sp>
        <p:nvSpPr><p:cNvPr id="${id}" name="box${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
          <a:prstGeom prst="${round ? 'roundRect' : 'rect'}"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
          <a:ln w="19050"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr" wrap="square" lIns="45720" rIns="45720" tIns="27432" bIns="27432"/>
          <a:lstStyle/>
          <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${size}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${fg}"/></a:solidFill></a:rPr><a:t>${xmlEsc(text)}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>`;
}
/** A plain text block (no shape outline). */
function textBlock(x, y, w, h, runs, { algn = 'l', anchor = 't' } = {}) {
  const id = shapeId++;
  const paras = runs
    .map(
      (r) =>
        `<a:p><a:pPr algn="${r.algn || algn}"/><a:r><a:rPr lang="en-US" sz="${r.size || 1200}" b="${r.bold ? 1 : 0}" i="${r.italic ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${r.color || '33414D'}"/></a:solidFill></a:rPr><a:t>${xmlEsc(r.text)}</a:t></a:r></a:p>`
    )
    .join('');
  return `      <p:sp>
        <p:nvSpPr><p:cNvPr id="${id}" name="text${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
        <p:txBody><a:bodyPr anchor="${anchor}" wrap="square"/><a:lstStyle/>${paras}</p:txBody>
      </p:sp>`;
}
/** A straight connector arrow between two points (EMU). */
function arrow(x1, y1, x2, y2, color = '2B6CB0') {
  const id = shapeId++;
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const cx = Math.max(Math.abs(x2 - x1), 1);
  const cy = Math.max(Math.abs(y2 - y1), 1);
  const flipH = x2 < x1 ? ' flipH="1"' : '';
  const flipV = y2 < y1 ? ' flipV="1"' : '';
  return `      <p:cxnSp>
        <p:nvCxnSpPr><p:cNvPr id="${id}" name="arrow${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
        <p:spPr>
          <a:xfrm${flipH}${flipV}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
          <a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>
          <a:ln w="28575"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:tailEnd type="triangle"/></a:ln>
        </p:spPr>
      </p:cxnSp>`;
}

// ---------- compose the slide ----------
const IN = (n) => Math.round(n * EMU);
const shapes = [];

// Title + tagline
shapes.push(
  textBlock(IN(0.6), IN(0.35), IN(12.1), IN(1.0), [
    { text: 'Architecture from the conversation', size: 3200, bold: true, color: '1A2733' },
    { text: 'Democratizing Enterprise & Solution Architecture — for everyone, not just architects', size: 1400, italic: true, color: '2B6CB0' },
  ])
);

// Pipeline row (y ~ 2.1in), 6 stages
const py = IN(2.15);
const ph = IN(1.05);
const stages = [
  { t: 'Record the meetings\nFunctional - Business - IT', fill: 'EAF1FB' },
  { t: 'Transcribe to text', fill: 'EAF1FB' },
  { t: 'LLM + ready-made prompt', fill: '2B6CB0', fg: 'FFFFFF', bold: true },
  { t: '4 Mermaid files\nfunctional - conceptual - logical - physical', fill: 'EAF1FB' },
  { t: 'Visio-as-Script editor', fill: '2B6CB0', fg: 'FFFFFF', bold: true },
  { t: '4 native Visio .vsdx', fill: 'EAF1FB' },
];
const margin = IN(0.6);
const gap = IN(0.18);
const pw = Math.round((W - margin * 2 - gap * (stages.length - 1)) / stages.length);
stages.forEach((s, i) => {
  const x = margin + i * (pw + gap);
  shapes.push(
    box(x, py, pw, ph, s.t.replace(/\n/g, '  '), {
      fill: s.fill,
      text: s.fg || '1A2733',
      bold: s.bold,
      size: 1100,
    })
  );
  if (i < stages.length - 1) {
    const ax = x + pw;
    shapes.push(arrow(ax + IN(0.01), py + ph / 2, ax + gap - IN(0.01), py + ph / 2));
  }
});

// The recycle loop callout
shapes.push(
  box(margin, IN(3.7), W - margin * 2, IN(0.7), 'Review with business + IT, then recycle: feed the previous 4 .mmd plus the new meeting transcript back to the LLM', {
    fill: 'FFF7E6',
    line: 'B7791F',
    text: '7B5300',
    size: 1200,
  })
);

// The four layers band
const ly = IN(4.85);
const lh = IN(1.5);
const layers = [
  { n: '1  Functional', d: 'Capabilities & outcomes\nBusiness audience\nTOGAF: Business' },
  { n: '2  Conceptual', d: 'Major building blocks & context\nBusiness + IT\nTOGAF: Business / Application' },
  { n: '3  Logical', d: 'Services, data, integrations\nArchitects & IT\nTOGAF: Application + Data' },
  { n: '4  Physical', d: 'Concrete deployment & tech\nEngineers & ops\nTOGAF: Technology' },
];
const lw = Math.round((W - margin * 2 - gap * (layers.length - 1)) / layers.length);
layers.forEach((l, i) => {
  const x = margin + i * (lw + gap);
  const id = shapeId++;
  shapes.push(`      <p:sp>
        <p:nvSpPr><p:cNvPr id="${id}" name="layer${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="${x}" y="${ly}"/><a:ext cx="${lw}" cy="${lh}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="F2F6FB"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="2B6CB0"/></a:solidFill></a:ln></p:spPr>
        <p:txBody><a:bodyPr anchor="t" wrap="square" lIns="64008" rIns="45720" tIns="45720"/><a:lstStyle/>
          <a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1400" b="1" dirty="0"><a:solidFill><a:srgbClr val="1A4971"/></a:solidFill></a:rPr><a:t>${xmlEsc(l.n)}</a:t></a:r></a:p>
          ${l.d
            .split('\n')
            .map((line) => `<a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1000" dirty="0"><a:solidFill><a:srgbClr val="33414D"/></a:solidFill></a:rPr><a:t>${xmlEsc(line)}</a:t></a:r></a:p>`)
            .join('')}
        </p:txBody>
      </p:sp>`);
});

// Footer
shapes.push(
  textBlock(margin, IN(6.65), W - margin * 2, IN(0.5), [
    { text: 'From a recorded discussion to four formal, editable architecture diagrams in under 10 minutes — then minutes per refinement.  Runs entirely in the browser. Open source, MIT.', size: 1000, italic: true, color: '6B7785', algn: 'ctr' },
  ])
);

const slideXml = `${DECL}
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${shapes.join('\n')}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>
</p:sld>`;

// ---------- fixed package parts ----------
const contentTypes = `${DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const rootRels = `${DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const coreProps = `${DECL}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Architecture from the conversation</dc:title>
  <dc:creator>Visio-as-Script</dc:creator>
</cp:coreProperties>`;

const appProps = `${DECL}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Visio-as-Script slide generator</Application>
  <Slides>1</Slides>
</Properties>`;

const presentation = `${DECL}
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="${W}" cy="${H}" type="screen16x9"/>
  <p:notesSz cx="${H}" cy="${W}"/>
</p:presentation>`;

const presentationRels = `${DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`;

const slideRels = `${DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const slideLayout = `${DECL}
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>
</p:sldLayout>`;

const slideLayoutRels = `${DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

const slideMaster = `${DECL}
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="3200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle>
    <p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle>
    <p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:otherStyle>
  </p:txStyles>
</p:sldMaster>`;

const slideMasterRels = `${DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;

const theme = `${DECL}
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:srgbClr val="1A2733"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1A4971"/></a:dk2>
      <a:lt2><a:srgbClr val="EAF1FB"/></a:lt2>
      <a:accent1><a:srgbClr val="2B6CB0"/></a:accent1>
      <a:accent2><a:srgbClr val="2F855A"/></a:accent2>
      <a:accent3><a:srgbClr val="B7791F"/></a:accent3>
      <a:accent4><a:srgbClr val="6B46C1"/></a:accent4>
      <a:accent5><a:srgbClr val="C53030"/></a:accent5>
      <a:accent6><a:srgbClr val="2C7A7B"/></a:accent6>
      <a:hlink><a:srgbClr val="2B6CB0"/></a:hlink>
      <a:folHlink><a:srgbClr val="6B46C1"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;

const parts = {
  '[Content_Types].xml': contentTypes,
  '_rels/.rels': rootRels,
  'docProps/core.xml': coreProps,
  'docProps/app.xml': appProps,
  'ppt/presentation.xml': presentation,
  'ppt/_rels/presentation.xml.rels': presentationRels,
  'ppt/theme/theme1.xml': theme,
  'ppt/slideMasters/slideMaster1.xml': slideMaster,
  'ppt/slideMasters/_rels/slideMaster1.xml.rels': slideMasterRels,
  'ppt/slideLayouts/slideLayout1.xml': slideLayout,
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels': slideLayoutRels,
  'ppt/slides/slide1.xml': slideXml,
  'ppt/slides/_rels/slide1.xml.rels': slideRels,
};

const zip = createZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, zip);
console.log(`Wrote ${OUT_FILE} (${(zip.length / 1024).toFixed(1)} KB, ${Object.keys(parts).length} parts)`);
