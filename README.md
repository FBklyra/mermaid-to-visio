# Visio-as-Script

**A Mermaid live editor that exports to native, editable Microsoft Visio
(`.vsdx`)** — real shapes and connectors, not an embedded image. It also exports
**SVG** and **high-res PNG**. Everything runs **client-side in the browser**; your
diagram never leaves the tab.

## ⚡ Fast track — use it in minutes (no source, no reading, no compiling)

Just want to use it? Pick one lane below. Everything here works the same on
**Windows, macOS, and Linux** — you never touch the source code.

### 1 · Run it now with Node (one command)
```bash
npx @klyratech/visio-editor
```
Starts the editor and opens your browser. Needs only [Node.js](https://nodejs.org)
18+ and internet (Mermaid loads from the CDN). Paste Mermaid → click
**Visio (.vsdx)**. Nothing to install, clone, or build.

### 2 · Install a package with npm
```bash
npm install -g @klyratech/visio-cli               # CLI for backends/pipelines:  vas render diagram.mmd
npm install @klyratech/mermaid-to-visio mermaid   # embed the .vsdx export in your own app/service
```

### 3 · Deploy on any web server (no Node, no build, works offline)
1. Download **`visio-as-script-web.zip`** from the
   [**Releases**](https://github.com/FBklyra/mermaid-to-visio/releases) page.
2. Unzip it into your web root — **IIS, nginx, Apache, or any static host**.
3. Open the site. Done. It runs 100% in the browser and works **fully offline**
   (the compiled Mermaid engine is inside the zip). Detailed IIS steps:
   [`visio-as-script-web/DEPLOY-IIS.md`](visio-as-script-web/DEPLOY-IIS.md).

> **Prefer to run that same bundle on your own machine, offline?** After unzipping,
> serve it with any static server (for example `node serve-web-local.mjs` from a
> clone, or `python -m http.server`). Opening `index.html` directly with
> `file://` will **not** work — browsers block ES-module apps there, so a tiny
> local server is required (Node alone is enough; no web-server install needed).

## What it does

- **Live preview** — paste Mermaid, see it render instantly; pan (left-drag), zoom
  (wheel / buttons), and copy the diagram to the clipboard for Word / PowerPoint /
  Paint.
- **Native Visio `.vsdx`** — real Visio shapes and connectors you can move and edit,
  not a picture pasted into a drawing.
- **SVG & high-res PNG** — vector export and rasterized PNG at a DPI you choose.
- **100% client-side** — Mermaid's layout needs a real DOM, and the browser already
  is one, so there's no server-side rendering, no upload, and no Puppeteer in the
  web app.

## This repo ships only the extension — not Mermaid

> **No copy of Mermaid lives in this repository.** You use the **official, public
> Mermaid** engine: loaded from a CDN by default, self-hosted for offline use, or
> installed from npm for the library/CLI. This project ships only the Visio-export
> *extension* and tooling. The one place a *compiled* Mermaid appears is inside the
> downloadable web bundle (a release artifact), never in the source tree.

## Use it three ways

### Web editor — [`@klyratech/visio-editor`](visio-as-script) (`npx`, no install)
```bash
npx @klyratech/visio-editor          # starts the editor and opens your browser
```
Or from a clone:
```bash
cd visio-as-script
node server.js                   # → http://localhost:5173
```
Zero dependencies — just Node; Mermaid loads from the CDN. Static/IIS and
Docker/Azure paths: [`visio-as-script/README.md`](visio-as-script/README.md) ·
[`visio-as-script-web/DEPLOY-IIS.md`](visio-as-script-web/DEPLOY-IIS.md).

**Ready-to-deploy bundle (offline, Mermaid included).** For a turnkey drop onto
any web server (IIS / nginx / Apache / static host) with **no CDN and no Node**:
**download `visio-as-script-web.zip` from the [Releases](https://github.com/FBklyra/mermaid-to-visio/releases)
page**, unzip it into your web root, and it runs fully offline — under five minutes,
no build.

To build the same bundle yourself:
```bash
npm install mermaid               # the official engine, from the public registry
npm run package:web               # → dist/visio-as-script-web/ and dist/visio-as-script-web.zip
```
The bundle is a **release artifact in `dist/` (git-ignored)** — the repo source
still ships no Mermaid; the compiled Mermaid lives only inside the downloadable zip.

### npm library — [`@klyratech/mermaid-to-visio`](packages/mermaid-to-visio)
```bash
npm install @klyratech/mermaid-to-visio mermaid
```
```js
import mermaid from 'mermaid';
import { renderToVisio } from '@klyratech/mermaid-to-visio';
const { bytes } = await renderToVisio(mermaid, 'id', 'flowchart TD\n A-->B', { title: 'Demo' });
```

### CLI — [`@klyratech/visio-cli`](packages/cli)
```bash
npm install -g @klyratech/visio-cli
vas render diagram.mmd                 # → diagram.vsdx
vas serve --port 4477                  # HTTP endpoint for pipelines
```

## Repository layout

```
README.md                      ← you are here
mermaid-to-visio/              source of the Visio-export extension (TypeScript)
packages/mermaid-to-visio/     the npm library @klyratech/mermaid-to-visio (built extension)
packages/cli/                  the CLI @klyratech/visio-cli (headless render + HTTP endpoint)
visio-as-script/               the runnable editor @klyratech/visio-editor (Node server + Docker)
visio-as-script-web/           flattened static copy of the editor for IIS / any static host
tools/build-web-package.mjs    builds the offline web bundle (dist/visio-as-script-web.zip)
serve-web-local.mjs            local server to test the static folder the way IIS serves it
```

The Visio-export **extension** is the only "engine" code here; Mermaid is external.

## Roadmap

- **Packaging — done:** the library (`@klyratech/mermaid-to-visio`), the CLI
  (`@klyratech/visio-cli`: `render` + `serve`), and the runnable editor
  (`@klyratech/visio-editor`).
- **Upstream — planned:** contribute the diagram-agnostic SVG→Visio capture to the
  Mermaid ecosystem as an add-on.
- **Publish:** first releases of the packages to npm under the `@klyratech` scope.

## License & legal

- **License:** [MIT](LICENSE) — the same license [Mermaid](https://mermaid.js.org/)
  uses. An extension of Mermaid, shared in the same spirit.
- **Disclaimer:** see [DISCLAIMER.md](DISCLAIMER.md) — the Software is provided
  "AS IS"; outputs are drafts for professional review, not finished deliverables.
- **Security:** report issues privately per [SECURITY.md](SECURITY.md).
- **Attribution & third-party notices:** [NOTICE](NOTICE) and
  [THIRD-PARTY-NOTICES](visio-as-script/THIRD-PARTY-NOTICES.md).

## About

Created by **Freddy Beltran** (<freddy.beltran@klyra.tech>) in the context of
**[MyStratos](https://mystratos.ai/en/)** — the AI-assisted strategy and
enterprise-architecture platform — and released as open source by
**[Klyra, AI-Enhanced Strategic Intelligence, Inc.](https://klyra.tech/)**

Visio-as-Script grew out of MyStratos's need to turn strategy and solution
conversations into formal, editable architecture artifacts in minutes instead of
days. It is published openly to share that capability with the wider community and
to demonstrate the engineering and applied-AI standards behind the platform.

> **Use it responsibly.** The Software is provided **"AS IS"**, without warranty
> of any kind, and its outputs are **drafts for professional review**, not
> finished deliverables. Before relying on anything it produces, read the full
> [**DISCLAIMER**](DISCLAIMER.md) and have a qualified professional validate the
> result. Nothing here constitutes professional architecture, engineering, legal,
> or other advice.

Authored with the assistance of AI tooling, reviewed by a human. See
[DISCLAIMER.md](DISCLAIMER.md) §4 on AI-generated content.
