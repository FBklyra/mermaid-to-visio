// src/colors.ts
function normalizeColor(value) {
  if (!value) {
    return void 0;
  }
  const v = value.trim().toLowerCase();
  if (v === "" || v === "none" || v === "transparent") {
    return void 0;
  }
  if (/^#[0-9a-f]{6}$/.test(v)) {
    return v.toUpperCase();
  }
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return ("#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toUpperCase();
  }
  const m = v.match(/^rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(",").map((s) => parseFloat(s));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      if (parts.length >= 4 && parts[3] === 0) {
        return void 0;
      }
      return ("#" + parts.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("")).toUpperCase();
    }
  }
  return void 0;
}

// src/svgCapture.ts
var SKIP_ANCESTORS = /* @__PURE__ */ new Set(["defs", "marker", "clippath", "symbol", "pattern", "mask"]);
var MAX_PATH_SAMPLES = 600;
var CIRCLE_SAMPLES = 48;
function captureSvgToDisplayList(svg) {
  forceIntrinsicSize(svg);
  const items = [];
  const walk = (el) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP_ANCESTORS.has(tag)) {
      return;
    }
    if (el instanceof SVGGraphicsElement && isHidden(el)) {
      return;
    }
    if (tag === "text") {
      collectText(el, items);
      return;
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
function polyFor(el) {
  const tag = el.tagName.toLowerCase();
  let local;
  let closed = false;
  switch (tag) {
    case "rect": {
      const x = num(el, "x");
      const y = num(el, "y");
      const w = num(el, "width");
      const h = num(el, "height");
      if (w <= 0 || h <= 0) return void 0;
      local = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ];
      closed = true;
      break;
    }
    case "circle": {
      const cx = num(el, "cx");
      const cy = num(el, "cy");
      const r = num(el, "r");
      if (r <= 0) return void 0;
      local = sampleEllipse(cx, cy, r, r);
      closed = true;
      break;
    }
    case "ellipse": {
      const cx = num(el, "cx");
      const cy = num(el, "cy");
      const rx = num(el, "rx");
      const ry = num(el, "ry");
      if (rx <= 0 || ry <= 0) return void 0;
      local = sampleEllipse(cx, cy, rx, ry);
      closed = true;
      break;
    }
    case "line":
      local = [
        { x: num(el, "x1"), y: num(el, "y1") },
        { x: num(el, "x2"), y: num(el, "y2") }
      ];
      break;
    case "polyline":
    case "polygon": {
      local = parsePoints(el.getAttribute("points"));
      closed = tag === "polygon";
      break;
    }
    case "path": {
      const sampled = samplePath(el);
      if (!sampled) return void 0;
      local = sampled.points;
      closed = sampled.closed;
      break;
    }
    default:
      return void 0;
  }
  if (!local || local.length < 2) {
    return void 0;
  }
  const points = simplifyCollinear(local.map((p) => toRoot(el, p.x, p.y)));
  if (points.length < 2) {
    return void 0;
  }
  const style = styleOf(el);
  if (!style.fill && !style.stroke) {
    return void 0;
  }
  return { kind: "poly", points, closed, ...style };
}
function sampleEllipse(cx, cy, rx, ry) {
  const pts = [];
  for (let i = 0; i < CIRCLE_SAMPLES; i++) {
    const a = i / CIRCLE_SAMPLES * 2 * Math.PI;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return pts;
}
function samplePath(el) {
  let total;
  try {
    total = el.getTotalLength();
  } catch {
    return void 0;
  }
  if (!total || !isFinite(total)) {
    return void 0;
  }
  const step = Math.max(1.5, total / MAX_PATH_SAMPLES);
  const pts = [];
  for (let d2 = 0; d2 <= total; d2 += step) {
    const p = el.getPointAtLength(d2);
    pts.push({ x: p.x, y: p.y });
  }
  const d = (el.getAttribute("d") ?? "").trim();
  return { points: pts, closed: /z\s*$/i.test(d) };
}
function parsePoints(raw) {
  if (!raw) return [];
  const nums = raw.trim().split(/[\s,]+/).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts;
}
function simplifyCollinear(points, tolerancePx = 0.35) {
  if (points.length <= 2) {
    return points;
  }
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const dist = Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx) / len;
    if (dist > tolerancePx) {
      out.push(b);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
function toRoot(el, x, y) {
  const ctm = el.getCTM();
  if (!ctm) {
    return { x, y };
  }
  return { x: ctm.a * x + ctm.c * y + ctm.e, y: ctm.b * x + ctm.d * y + ctm.f };
}
function collectText(textEl, items) {
  if (isHidden(textEl)) {
    return;
  }
  const lineTspans = Array.from(textEl.children).filter(
    (c) => c.tagName.toLowerCase() === "tspan" && c.hasAttribute("x")
  );
  if (lineTspans.length >= 2) {
    for (const line of lineTspans) {
      pushText(line, line.textContent ?? "", items);
    }
  } else {
    pushText(textEl, textEl.textContent ?? "", items);
  }
}
function pushText(el, raw, items) {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) {
    return;
  }
  let bbox;
  try {
    bbox = el.getBBox();
  } catch {
    return;
  }
  if (bbox.width === 0 && bbox.height === 0) {
    return;
  }
  const corners = [
    toRoot(el, bbox.x, bbox.y),
    toRoot(el, bbox.x + bbox.width, bbox.y),
    toRoot(el, bbox.x + bbox.width, bbox.y + bbox.height),
    toRoot(el, bbox.x, bbox.y + bbox.height)
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  const style = textStyleOf(el);
  items.push({ kind: "text", text, x, y, width, height, ...style });
}
function textStyleOf(el) {
  const cs = getComputedStyle(el);
  const leaf = deepestTextNodeHost(el) ?? el;
  const leafCs = getComputedStyle(leaf);
  const weight = leafCs.fontWeight || cs.fontWeight;
  return {
    fontPx: parseFloat(cs.fontSize) || 12,
    fontFamily: (cs.fontFamily || "Arial").split(",")[0].replace(/["']/g, "").trim(),
    bold: weight === "bold" || parseInt(weight, 10) >= 600,
    italic: (leafCs.fontStyle || cs.fontStyle) === "italic",
    anchor: normalizeAnchor(cs.textAnchor),
    fill: normalizeColor(leafCs.fill) ?? normalizeColor(cs.fill) ?? "#000000"
  };
}
function deepestTextNodeHost(el) {
  let cur = el;
  while (cur) {
    const childEl = Array.from(cur.children).find(
      (c) => c.tagName.toLowerCase() === "tspan"
    );
    if (!childEl) break;
    cur = childEl;
  }
  return cur === el ? void 0 : cur;
}
function normalizeAnchor(value) {
  return value === "middle" ? "middle" : value === "end" ? "end" : "start";
}
function styleOf(el) {
  const cs = getComputedStyle(el);
  return {
    fill: normalizeColor(cs.fill),
    stroke: normalizeColor(cs.stroke),
    strokeWidthPx: parseFloat(cs.strokeWidth) || 1,
    dash: !!cs.strokeDasharray && cs.strokeDasharray !== "none" && cs.strokeDasharray !== "0"
  };
}
function isHidden(el) {
  const cs = getComputedStyle(el);
  return cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0;
}
function num(el, attr) {
  return parseFloat(el.getAttribute(attr) ?? "0") || 0;
}
function forceIntrinsicSize(svg) {
  const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
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
    }
  }
  if (w > 0 && h > 0) {
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    svg.style.maxWidth = "none";
    svg.style.width = `${w}px`;
    svg.style.height = `${h}px`;
  }
}
function pageSize(svg) {
  const vb = svg.getAttribute("viewBox");
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

// src/coordinates.ts
var PX_PER_INCH = 96;
var PX_TO_IN = 1 / PX_PER_INCH;
var CoordinateSpace = class {
  /**
   * @param bounds   Content bounding box in SVG pixels.
   * @param marginPx Uniform margin (in pixels) added around the content so the
   *                 diagram is not flush against the page edge.
   */
  constructor(bounds, marginPx = 16) {
    this.minX = bounds.minX - marginPx;
    this.maxY = bounds.maxY + marginPx;
    const widthPx = bounds.maxX - bounds.minX + marginPx * 2;
    const heightPx = bounds.maxY - bounds.minY + marginPx * 2;
    this.pageWidthIn = round(widthPx * PX_TO_IN);
    this.pageHeightIn = round(heightPx * PX_TO_IN);
  }
  /** Convert an absolute SVG pixel point to an absolute Visio inch point. */
  point(p) {
    return {
      x: round((p.x - this.minX) * PX_TO_IN),
      y: round((this.maxY - p.y) * PX_TO_IN)
    };
  }
  /** Convert a pixel length (width/height/stroke) to inches (no flip). */
  length(px) {
    return round(px * PX_TO_IN);
  }
};
function boundsOf(points) {
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
function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

// src/zipStore.ts
var encoder = new TextEncoder();
function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 67324752, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 2048, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    locals.push(local);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 33639248, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 2048, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 101010256, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  return concat([...locals, ...centrals, eocd]);
}
function utf8(s) {
  return encoder.encode(s);
}
var CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(data) {
  let crc = 4294967295;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 255] ^ crc >>> 8;
  }
  return (crc ^ 4294967295) >>> 0;
}
function concat(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// src/opcPackage.ts
var XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
var NS_MAIN = "http://schemas.microsoft.com/office/visio/2012/main";
var NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
function buildVsdxPackage(input) {
  const parts = {
    "[Content_Types].xml": contentTypes(),
    "_rels/.rels": rootRels(),
    "docProps/core.xml": coreProps(input.title),
    "docProps/app.xml": appProps(),
    "visio/document.xml": documentXml(),
    "visio/_rels/document.xml.rels": documentRels(),
    "visio/windows.xml": windowsXml(),
    "visio/pages/pages.xml": pagesXml(input.pageWidthIn, input.pageHeightIn),
    "visio/pages/_rels/pages.xml.rels": pagesRels(),
    "visio/pages/page1.xml": input.pageContents
  };
  const entries = Object.entries(parts).map(([name, content]) => ({
    name,
    data: utf8(content)
  }));
  return createZip(entries);
}
function contentTypes() {
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
function rootRels() {
  return `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}
function coreProps(title) {
  return `${XML_DECL}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>mermaid</dc:creator>
</cp:coreProperties>`;
}
function appProps() {
  return `${XML_DECL}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Mermaid Visio Export</Application>
</Properties>`;
}
function documentXml() {
  return `${XML_DECL}
<VisioDocument xmlns="${NS_MAIN}" xmlns:r="${NS_R}" xml:space="preserve">
  <DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0"/>
  <Colors/>
  <FaceNames/>
  <StyleSheets/>
</VisioDocument>`;
}
function documentRels() {
  return `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/windows" Target="windows.xml"/>
</Relationships>`;
}
function windowsXml() {
  return `${XML_DECL}
<Windows xmlns="${NS_MAIN}" xmlns:r="${NS_R}" ClientWidth="1000" ClientHeight="800"/>`;
}
function pagesXml(widthIn, heightIn) {
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
function pagesRels() {
  return `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>
</Relationships>`;
}
function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// src/vsdxBuilder.ts
var MIN_LINE_WEIGHT_IN = 69e-4;
function buildVsdxFromDisplayList(list, options = {}) {
  const space = buildSpace(list);
  let id = 1;
  let shapes = 0;
  let texts = 0;
  const shapeXml = [];
  for (const item of list.items) {
    if (item.kind === "poly") {
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
${shapeXml.join("\n")}
  </Shapes>
</PageContents>`;
  const bytes = buildVsdxPackage({
    pageContents,
    pageWidthIn: space.pageWidthIn,
    pageHeightIn: space.pageHeightIn,
    title: options.title ?? "Mermaid Diagram"
  });
  return { bytes, stats: { shapes, texts } };
}
function buildSpace(list) {
  const pts = [];
  for (const item of list.items) {
    if (item.kind === "poly") {
      pts.push(...item.points);
    } else {
      pts.push({ x: item.x, y: item.y }, { x: item.x + item.width, y: item.y + item.height });
    }
  }
  if (pts.length === 0) {
    pts.push({ x: 0, y: 0 }, { x: list.width || 1, y: list.height || 1 });
  }
  return new CoordinateSpace(boundsOf(pts));
}
function polyShapeXml(id, item, space) {
  const inch = item.points.map((p) => space.point(p));
  const xs = inch.map((p) => p.x);
  const ys = inch.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1e-3);
  const height = Math.max(maxY - minY, 1e-3);
  const hasFill = !!item.fill;
  const hasLine = !!item.stroke;
  const rows = [];
  inch.forEach((p, i) => {
    const lx = round(p.x - minX);
    const ly = round(p.y - minY);
    rows.push(
      `        <Row T="${i === 0 ? "MoveTo" : "LineTo"}" IX="${i + 1}"><Cell N="X" V="${lx}"/><Cell N="Y" V="${ly}"/></Row>`
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
    cell("PinX", round((minX + maxX) / 2)),
    cell("PinY", round((minY + maxY) / 2)),
    cell("Width", round(width)),
    cell("Height", round(height)),
    cell("LocPinX", round(width / 2)),
    cell("LocPinY", round(height / 2)),
    cell("Angle", 0),
    ...hasFill ? [strCell("FillForegnd", item.fill), cell("FillPattern", 1)] : [cell("FillPattern", 0)],
    ...hasLine ? [
      strCell("LineColor", item.stroke),
      cell("LineWeight", round(Math.max(space.length(item.strokeWidthPx), MIN_LINE_WEIGHT_IN))),
      cell("LinePattern", item.dash ? 2 : 1)
    ] : [cell("LinePattern", 0)]
  ];
  return [
    `    <Shape ID="${id}" Type="Shape">`,
    `      ${cells.join("")}`,
    `      <Section N="Geometry" IX="0">`,
    `        <Cell N="NoFill" V="${hasFill ? 0 : 1}"/><Cell N="NoLine" V="${hasLine ? 0 : 1}"/>`,
    rows.join("\n"),
    `      </Section>`,
    `    </Shape>`
  ].join("\n");
}
function textShapeXml(id, item, space) {
  const topLeft = space.point({ x: item.x, y: item.y });
  const bottomRight = space.point({ x: item.x + item.width, y: item.y + item.height });
  const width = Math.max(Math.abs(bottomRight.x - topLeft.x), 0.02);
  const height = Math.max(Math.abs(topLeft.y - bottomRight.y), 0.02);
  const pinX = (topLeft.x + bottomRight.x) / 2;
  const pinY = (topLeft.y + bottomRight.y) / 2;
  const sizeIn = round(item.fontPx / 96);
  const styleBits = (item.bold ? 1 : 0) | (item.italic ? 2 : 0);
  const horiz = item.anchor === "middle" ? 1 : item.anchor === "end" ? 2 : 0;
  const cells = [
    cell("PinX", round(pinX)),
    cell("PinY", round(pinY)),
    cell("Width", round(width)),
    cell("Height", round(height)),
    cell("LocPinX", round(width / 2)),
    cell("LocPinY", round(height / 2)),
    cell("Angle", 0),
    cell("FillPattern", 0),
    cell("LinePattern", 0),
    cell("VerticalAlign", 1),
    // Keep text on one line; Visio should not re-wrap our already-laid-out runs.
    cell("TextDirection", 0)
  ];
  return [
    `    <Shape ID="${id}" Type="Shape">`,
    `      ${cells.join("")}`,
    `      <Section N="Character"><Row IX="0"><Cell N="Color" V="${escapeXml(
      item.fill
    )}"/><Cell N="Size" V="${sizeIn}"/><Cell N="Style" V="${styleBits}"/></Row></Section>`,
    `      <Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="${horiz}"/></Row></Section>`,
    `      <Text>${escapeXml(item.text)}</Text>`,
    `    </Shape>`
  ].join("\n");
}
function cell(name, value) {
  return `<Cell N="${name}" V="${value}"/>`;
}
function strCell(name, value) {
  return `<Cell N="${name}" V="${escapeXml(value)}"/>`;
}

// src/index.ts
function svgElementToVsdx(svg, options = {}) {
  return buildVsdxFromDisplayList(captureSvgToDisplayList(svg), options);
}
async function renderToVisio(mermaid, id, definition, options = {}) {
  if (typeof document === "undefined") {
    throw new Error(
      "renderToVisio requires a DOM environment (browser or headless browser)."
    );
  }
  const { svg } = await mermaid.render(id, definition);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "absolute";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.innerHTML = svg;
  document.body.appendChild(host);
  try {
    const svgEl = host.querySelector("svg");
    if (!svgEl) {
      throw new Error("Mermaid did not produce an SVG element to export.");
    }
    return svgElementToVsdx(svgEl, options);
  } finally {
    host.remove();
  }
}
export {
  CoordinateSpace,
  boundsOf,
  buildVsdxFromDisplayList,
  captureSvgToDisplayList,
  normalizeColor,
  renderToVisio,
  svgElementToVsdx
};
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
