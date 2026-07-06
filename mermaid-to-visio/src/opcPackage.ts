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
 * Assembles the Open Packaging Convention (OPC) ZIP that *is* a .vsdx file.
 *
 * A .vsdx is an OPC package: a ZIP archive of XML "parts" wired together by
 * `.rels` relationship files, with a `[Content_Types].xml` manifest declaring
 * each part's MIME type. This module owns the fixed skeleton of that package;
 * the variable part (the page's shapes) is injected by the exporter.
 */

import { createZip, utf8, type ZipEntry } from './zipStore.js';

export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Microsoft Visio 2012 main namespace (used by .vsdx since Visio 2013). */
export const NS_MAIN = 'http://schemas.microsoft.com/office/visio/2012/main';
/** OPC relationships namespace used for r:id references inside parts. */
export const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export interface VsdxPackageInput {
  /** Full <PageContents> XML for the single page. */
  pageContents: string;
  /** Page width in inches. */
  pageWidthIn: number;
  /** Page height in inches. */
  pageHeightIn: number;
  /** Document title for core properties. */
  title: string;
}

/** Build the complete .vsdx byte buffer from the page contents. */
export function buildVsdxPackage(input: VsdxPackageInput): Uint8Array {
  const parts: Record<string, string> = {
    '[Content_Types].xml': contentTypes(),
    '_rels/.rels': rootRels(),
    'docProps/core.xml': coreProps(input.title),
    'docProps/app.xml': appProps(),
    'visio/document.xml': documentXml(),
    'visio/_rels/document.xml.rels': documentRels(),
    'visio/windows.xml': windowsXml(),
    'visio/pages/pages.xml': pagesXml(input.pageWidthIn, input.pageHeightIn),
    'visio/pages/_rels/pages.xml.rels': pagesRels(),
    'visio/pages/page1.xml': input.pageContents,
  };

  const entries: ZipEntry[] = Object.entries(parts).map(([name, content]) => ({
    name,
    data: utf8(content),
  }));
  return createZip(entries);
}

function contentTypes(): string {
  return `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
  <Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>
  <Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
  <Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function rootRels(): string {
  return `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function coreProps(title: string): string {
  return `${XML_DECL}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>mermaid</dc:creator>
</cp:coreProperties>`;
}

function appProps(): string {
  return `${XML_DECL}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Mermaid Visio Export</Application>
</Properties>`;
}

function documentXml(): string {
  return `${XML_DECL}
<VisioDocument xmlns="${NS_MAIN}" xmlns:r="${NS_R}" xml:space="preserve">
  <DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0"/>
  <Colors/>
  <FaceNames/>
  <StyleSheets/>
</VisioDocument>`;
}

function documentRels(): string {
  return `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/windows" Target="windows.xml"/>
</Relationships>`;
}

function windowsXml(): string {
  return `${XML_DECL}
<Windows xmlns="${NS_MAIN}" xmlns:r="${NS_R}" ClientWidth="1000" ClientHeight="800"/>`;
}

function pagesXml(widthIn: number, heightIn: number): string {
  return `${XML_DECL}
<Pages xmlns="${NS_MAIN}" xmlns:r="${NS_R}" xml:space="preserve">
  <Page ID="0" NameU="Page-1" Name="Page-1" ViewScale="-1" ViewCenterX="${widthIn / 2}" ViewCenterY="${heightIn / 2}">
    <PageSheet>
      <Cell N="PageWidth" V="${widthIn}"/>
      <Cell N="PageHeight" V="${heightIn}"/>
      <Cell N="ShdwOffsetX" V="0.1181"/>
      <Cell N="ShdwOffsetY" V="-0.1181"/>
      <Cell N="PageScale" V="1"/>
      <Cell N="DrawingScale" V="1"/>
      <Cell N="DrawingSizeType" V="3"/>
      <Cell N="DrawingScaleType" V="0"/>
    </PageSheet>
    <Rel r:id="rId1"/>
  </Page>
</Pages>`;
}

function pagesRels(): string {
  return `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>
</Relationships>`;
}

/** Escape a string for use in XML text or attribute content. */
export function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
