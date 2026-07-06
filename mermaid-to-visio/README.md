# mermaid-to-visio

Convert [Mermaid](https://mermaid.js.org/) diagrams to **native Microsoft Visio
(`.vsdx`)** files — real shapes and text at the exact coordinates Mermaid draws
them, not a flat image.

A companion library for Mermaid: **render with Mermaid, export to Visio.** It is
diagram-type-agnostic — flowchart, class, state, ER, sequence, gantt, pie, git,
and more — because it reproduces whatever Mermaid renders rather than
understanding any specific diagram.

```
Mermaid definition ──[ mermaid.render ]──▶ SVG ──[ mermaid-to-visio ]──▶ .vsdx
```

## Install

```bash
npm install mermaid-to-visio mermaid
```

`mermaid` is an optional **peer** dependency — install the version you want;
this library never bundles or pins it.

## Use

### From a Mermaid definition

```ts
import mermaid from 'mermaid';
import { renderToVisio } from 'mermaid-to-visio';

mermaid.initialize({ startOnLoad: false, htmlLabels: false });

const { bytes, stats } = await renderToVisio(
  mermaid,
  'diagram-1',
  'flowchart TD\n A[Start] --> B{Decision} --> C[End]',
  { title: 'My Diagram' }
);
// bytes: Uint8Array (a .vsdx package) — save it or offer it as a download.
// stats: { shapes, texts }
```

### From an SVG you already have on the page

```ts
import { svgElementToVsdx } from 'mermaid-to-visio';

const { bytes } = svgElementToVsdx(document.querySelector('svg'));
```

> **Requires a DOM.** Mermaid measures text with `getBBox`/`getCTM`/
> `getComputedStyle`, which resolve only for an element laid out in the document.
> Use this in a browser, or under a headless browser (e.g. Puppeteer) — not bare
> Node or jsdom. Set `htmlLabels: false` so labels render as `<text>` (captured)
> rather than HTML `<foreignObject>` (not captured).

## How it works

Mermaid renders the diagram to SVG exactly as normal. This library then walks the
rendered SVG and reproduces every primitive it finds — rectangles, text, paths,
lines, polygons, circles — as a native Visio shape at the same position. The
`.vsdx` is built from scratch on the open **Open Packaging Conventions**
(ECMA-376 / ISO/IEC 29500) with a dependency-free ZIP writer.

**Known approximations:** curved outlines become fine poly-lines; SVG marker
decorations (arrowheads, ER crow's-foot ends) defined in `<defs>` are not yet
stamped onto line ends; gradients/filters degrade to flat fills.

## API

| Export | Description |
|--------|-------------|
| `renderToVisio(mermaid, id, definition, options?)` | Render a Mermaid definition and convert it. Returns `{ bytes, stats }`. |
| `svgElementToVsdx(svgEl, options?)` | Convert an already-rendered, DOM-attached SVG element. |
| `captureSvgToDisplayList(svgEl)` | Low-level: SVG → backend-agnostic display list. |
| `buildVsdxFromDisplayList(list, options?)` | Low-level: display list → `.vsdx` bytes. |

`options`: `{ title?: string }`.

## License

MIT — see [LICENSE](./LICENSE). Built on Mermaid (MIT) and Microsoft's open
`.vsdx` specifications; see [THIRD-PARTY-NOTICES](./THIRD-PARTY-NOTICES.md).
Not affiliated with or endorsed by Microsoft.
