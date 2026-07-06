# @klyratech/mermaid-to-visio

Convert a **Mermaid-rendered SVG** into a **native Microsoft Visio drawing
(`.vsdx`)** — real shapes and connectors, not an embedded image. Diagram-type
agnostic: it reproduces whatever primitives Mermaid draws.

> **This package contains no copy of Mermaid.** You bring the **official public
> Mermaid** engine yourself (npm, CDN, or self-hosted) and pass it in. This
> package is the *extension* only.

## Install

```bash
npm install @klyratech/mermaid-to-visio mermaid
```

`mermaid` is an **optional peer dependency** — required only if you use the
`renderToVisio(mermaid, …)` convenience helper. If you already have a rendered
SVG element, you can call `svgElementToVsdx(svgEl)` with no Mermaid at all.

## Requirements

The conversion reads real geometry from the SVG (`getBBox`, `getCTM`,
`getPointAtLength`, `getComputedStyle`), so it must run in a **DOM environment**:
a browser, or Node with a headless browser (e.g. Puppeteer/Playwright). Pure
`jsdom` will not work — it does not implement SVG layout. For a ready-made
headless CLI, see [`@klyratech/visio-cli`](https://github.com/FBklyra/mermaid-to-visio/tree/main/packages/cli).

## Usage

### In the browser (you have a Mermaid instance)

```js
import mermaid from 'mermaid';
import { renderToVisio } from '@klyratech/mermaid-to-visio';

mermaid.initialize({ startOnLoad: false, htmlLabels: false, flowchart: { htmlLabels: false } });

const { bytes, stats } = await renderToVisio(mermaid, 'diagram-id', 'flowchart TD\n A-->B', {
  title: 'My Diagram',
});
// `bytes` is a Uint8Array of a .vsdx file
new Blob([bytes], { type: 'application/vnd.ms-visio.drawing' });
```

> Use `htmlLabels:false` so Mermaid emits `<text>` (not `<foreignObject>`); that
> is what makes the export reproduce labels faithfully.

### From an existing SVG element (no Mermaid needed)

```js
import { svgElementToVsdx } from '@klyratech/mermaid-to-visio';

const { bytes } = svgElementToVsdx(document.querySelector('svg'), { title: 'Diagram' });
```

## API

| Export | Description |
|--------|-------------|
| `renderToVisio(mermaid, id, definition, opts?)` | Render Mermaid source → `.vsdx`. Async. Returns `{ bytes, stats }`. |
| `svgElementToVsdx(svgEl, opts?)` | Convert an already-rendered SVG element → `.vsdx`. Returns `{ bytes, stats }`. |
| `captureSvgToDisplayList(svgEl)` | Walk an SVG into a flat display list (polys + text) in SVG pixels. |
| `buildVsdxFromDisplayList(list, opts?)` | Build the `.vsdx` package bytes from a display list. |
| `CoordinateSpace`, `boundsOf`, `normalizeColor` | Lower-level helpers. |

`opts`: `{ title?: string }`.

## How it works

1. Render with the **official Mermaid** to an SVG in the live DOM.
2. Walk the SVG, sampling each primitive (`rect`/`circle`/`ellipse`/`line`/
   `poly*`/`path`) into polygons and each `<text>` into a positioned run, mapped to
   root coordinates.
3. Convert pixels → inches (96 px/in) and flip the Y axis (SVG y-down → Visio
   y-up); emit one Visio `<Shape>` per item.
4. Assemble the Visio OPC part tree and zip it with a dependency-free store-only
   ZIP writer.

## License

MIT © Klyra, AI-Enhanced Strategic Intelligence, Inc. — see [LICENSE](LICENSE).
"Microsoft" and "Visio" are trademarks of Microsoft Corporation; this project is
not affiliated with or endorsed by Microsoft.
