# Visio-as-Script

An open-source web editor for [Mermaid](https://mermaid.js.org/) — paste a
diagram script, watch it render live, and download it as **SVG**, **high-res
PNG**, or a **native Visio drawing (`.vsdx`)** with real shapes and connectors.

A mermaid.live-style experience, plus the one thing mermaid.live can't do:
**export to Visio.** Everything runs in your browser — your diagram never leaves
the tab.

```
Mermaid source ──▶ live SVG preview ──┬──▶ SVG   (vector, resolution-independent)
                                      ├──▶ PNG   (rasterized at a chosen DPI, default 720)
                                      └──▶ .vsdx (native Visio: shapes + glued connectors)
```

## Why it's simple

The app renders with **stock Mermaid** and exports with the
[`mermaid-to-visio`](../mermaid-to-visio) companion library — which is diagram-
type-agnostic and reproduces every primitive Mermaid draws, so the `.vsdx`
matches the SVG exactly. Mermaid's layout needs a real DOM (`getBBox`). A CLI
borrows one via headless Chromium; **a browser already is one**, so this web app
needs no Puppeteer, no server-side rendering, no upload. The page loads stock
Mermaid plus the library and does all the work client-side.

## Run

The app serves the UI and the **Visio-export extension** from `vendor/`. It does
**not** bundle Mermaid — the browser loads the **official public Mermaid** from a
CDN (via the import map in `public/index.html`). There is **nothing to build**:

```bash
cd visio-as-script
node server.js
# → http://localhost:5173
```

That's it. Zero dependencies — just Node. Open the URL and paste a diagram.

### Offline / intranet (self-host Mermaid)

If the browser can't reach the CDN, serve the official Mermaid yourself:

```bash
npm install mermaid          # the official engine, from the public registry
npm run fetch-mermaid        # copies it into ./public/mermaid (git-ignored)
```

Then point the import map in `public/index.html` at `/mermaid/mermaid.esm.min.mjs`.
You can also pass an existing dist via `MERMAID_DIST=/path/to/dist node server.js`.

### Refreshing the extension

After a change to the `mermaid-to-visio` source:

```bash
(cd ../mermaid-to-visio && npm install && npm run build)   # build the extension
npm run vendor                                             # copy it into ./vendor (and the other copies)
node server.js
```

Change the port with `PORT=8080 node server.js`.

## Exports

| Button        | Format | Notes |
|---------------|--------|-------|
| **SVG**       | `.svg` | Vector. Resolution-independent — best for further editing. |
| **PNG**       | `.png` | Rasterized at the **DPI** field (default **720**; `scale = dpi / 96`). |
| **Visio**     | `.vsdx`| Native Visio package — real shapes + connectors, identical distribution to the SVG. |

> **On "SVG at 720 DPI":** SVG is vector and has no inherent DPI — it scales
> infinitely. DPI only matters when rasterizing to pixels, which is what the
> **PNG** export does. So you get both: a true vector SVG *and* a 720-DPI raster.

## Deploy (Docker → Azure intranet)

The app has zero runtime npm dependencies and bundles **no copy of Mermaid** (the
browser loads it from the CDN). Vendor the extension once, then build:

```bash
# 1. Make sure the extension is vendored into the project
npm run vendor

# 2. Build & run the container locally (listens on 8080 inside the container)
docker build -t visio-as-script .
docker run --rm -p 5173:8080 visio-as-script
# → http://localhost:5173
```

> For an **offline** image, run `npm install mermaid && npm run fetch-mermaid`
> first (so `public/mermaid/` exists) and point the import map at it before
> building — the container then needs no external CDN.

### Push to Azure (Container Registry + App Service for Containers)

```bash
# Variables
RG=rg-diagrams; ACR=myacr; APP=visio-as-script; PLAN=plan-diagrams

# Build straight into Azure Container Registry (no local Docker needed)
az acr create -g $RG -n $ACR --sku Basic
az acr build -r $ACR -t visio-as-script:latest .

# Host it on a small Linux App Service (B1 is plenty)
az appservice plan create -g $RG -n $PLAN --is-linux --sku B1
az webapp create -g $RG -p $PLAN -n $APP \
  --deployment-container-image-name $ACR.azurecr.io/visio-as-script:latest
az webapp config appsettings set -g $RG -n $APP --settings WEBSITES_PORT=8080
```

> The container listens on `8080` (`ENV PORT`/`EXPOSE`); `WEBSITES_PORT=8080`
> tells App Service which port to route to. For **Azure Container Apps** or
> **ACI** instead, point them at the same `$ACR.azurecr.io/visio-as-script`
> image — the port is auto-detected from `EXPOSE`.

Since it's an internal tool, restrict access via your App Service **VNet
integration / private endpoint** or access restrictions, per your intranet setup.

## Files

```
visio-as-script/
  server.js                 zero-dependency static server (editor + extension; optional self-hosted Mermaid)
  public/
    index.html              two-pane editor UI (import map → official Mermaid CDN)
    app.js                  live render + SVG/PNG/VSDX export (all client-side)
    style.css
    mermaid/                OPTIONAL, git-ignored — official Mermaid if you self-host (npm run fetch-mermaid)
  vendor/mermaid-to-visio/  the Visio-export extension (build artifact, see npm run vendor)
  scripts/vendor-extension.mjs  copies the built extension into all repo copies
  scripts/fetch-mermaid.mjs     optional: self-host the official Mermaid for offline use
  Dockerfile                node:20-alpine image (used for Azure deploy)
  .dockerignore
```

## License

MIT. An extension of Mermaid, shared in the same spirit.
