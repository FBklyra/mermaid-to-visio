# visio-as-script-web — IIS deployment (hand-off note)

This is a **static web app**. It runs entirely in the browser; the server only
serves files. There is **no Node, no application pool runtime, no database, and
no installer**. Any static file host works — these instructions are for IIS.

## What to do

1. Copy the **contents** of this `visio-as-script-web` folder — *not the folder
   itself* — into the site's web root (e.g. `C:\inetpub\wwwroot\visio`). So
   `index.html` must sit **directly** in the web root, not one level down inside
   a `visio-as-script-web\` sub-folder. See the exact result below.
2. Point an IIS **Site** (or its own hostname, e.g. `visio.intranet.local`) at
   that web root. The included `web.config` does the rest.
3. Browse to the site — paste a Mermaid diagram, export to SVG / PNG / Visio.

That's it. Under 1 MB of files, no build step.

> **Mermaid is not included here.** By default the editor loads the **official
> public Mermaid** from a CDN (jsDelivr), so the IIS box needs outbound internet
> access on the user's browser. For an **offline / air-gapped** intranet, see
> [Offline: self-host Mermaid](#offline-self-host-mermaid) below.

## Exactly what the web root must contain (do not rearrange — URLs depend on it)

After copying, the web root looks like this — `index.html` and the folder sit at
the **top level** of the root:

```
C:\inetpub\wwwroot\visio\         ← the IIS site's "Physical path" points HERE
  index.html                      the editor page (import map → official Mermaid CDN)
  app.js                          live render + SVG/PNG/VSDX export (client-side)
  style.css
  mermaid-to-visio\               Visio (.vsdx) export extension (served at /mermaid-to-visio/*)
  web.config                      IIS config — chiefly the .mjs MIME mapping
  (mermaid\)                      OPTIONAL — only if you self-host Mermaid offline
```

✅ Correct:  `C:\inetpub\wwwroot\visio\index.html`
❌ Wrong:    `C:\inetpub\wwwroot\visio\visio-as-script-web\index.html`
   (a nested folder breaks the app — the root-absolute URLs below won't resolve)

> Tip: it doesn't have to be `...\wwwroot\visio`. Any folder works as long as the
> IIS site's **Physical path** points at the folder that *directly* contains
> `index.html`. The `DEPLOY-IIS.md` and `web.config` files can stay in the root;
> they're harmless (`web.config` is read by IIS, this note is just ignored).

## Requirements on the IIS box

- **Static content** role service enabled (default on IIS).
- Outbound internet access (from the **user's browser**) to the Mermaid CDN —
  unless you self-host Mermaid (see below).
- The `.mjs` MIME mapping in `web.config` is required **if you self-host Mermaid**
  (its engine is served as `.mjs`). It is harmless otherwise; keep it.
- *(Optional)* "Static Content Compression" feature for faster first load; the
  `web.config` uses it if present and ignores it if not.

## Offline: self-host Mermaid

> **Easiest:** run `npm install mermaid && npm run package:web` at the repo root to
> get a ready-to-deploy bundle (`dist/visio-as-script-web/` or its `.zip`) that
> **already includes the compiled Mermaid** and is wired for offline use. Copy
> that to your web root and you're done — skip the manual steps below.

For an air-gapped or strict intranet, serve the official Mermaid yourself instead
of the CDN:

1. On a machine with internet, get the official engine and copy it in:
   ```bash
   npm install mermaid
   # copy node_modules/mermaid/dist  →  <web root>\mermaid\
   ```
   (Or use `visio-as-script/scripts/fetch-mermaid.mjs`.) Never commit this copy —
   it is the official Mermaid under its own license, obtained by you.
2. Edit the import map in `index.html` to point at the local copy:
   ```json
   { "imports": {
       "mermaid": "/mermaid/mermaid.esm.min.mjs",
       "mermaid-to-visio": "/mermaid-to-visio/index.js"
   } }
   ```
3. Ensure the `.mjs` MIME mapping is active (it is, via `web.config`). Done — no
   external calls.

## Important: host at a site ROOT, not a sub-folder

The page loads its assets with **root-absolute** URLs (`/app.js`,
`/mermaid/...`, `/mermaid-to-visio/...`). So it must be served at the root of a
site or hostname:

- ✅ `http://visio.intranet.local/`  → works as-is
- ✅ `http://server/` (this app is the whole site)  → works as-is
- ❌ `http://server/visio-app/` (app under a sub-path / virtual directory)
  → the absolute URLs resolve to the wrong place and the app breaks.

If it **must** live under a sub-path, tell the app owner — a small code change
(switching those absolute paths to relative) is required first.

## Privacy / security notes

- **No diagram data ever leaves the browser** — there is no upload and no API
  call with your content. All rendering and conversion happen in the user's tab.
- In **CDN mode** the browser fetches the Mermaid *engine* (code) from jsDelivr —
  your diagram text is never sent. If even fetching the engine is unacceptable,
  use the offline self-host option above for zero external calls.
- As an internal tool, restrict reach with the usual IIS controls (IP/domain
  restrictions, Windows auth, or intranet-only binding) per your policy.
