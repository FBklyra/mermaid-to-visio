# @klyratech/visio-cli

Headless command-line tool to convert **Mermaid** diagrams into native
**Microsoft Visio (`.vsdx`)**, **SVG**, or **PNG** — and an **HTTP endpoint** for
automated pipelines.

> **No copy of Mermaid is bundled.** This CLI uses the **official public Mermaid**
> as an ordinary npm dependency (installed from the registry, never committed). It
> drives a headless Chromium (Puppeteer) so Mermaid's real layout works, then
> exports with the [`@klyratech/mermaid-to-visio`](../mermaid-to-visio) extension.

## Install

```bash
npm install -g @klyratech/visio-cli
# Puppeteer downloads a headless Chromium on install.
```

## Render

```bash
vas render diagram.mmd                  # → diagram.vsdx
vas render diagram.mmd -o out.vsdx
vas render a.mmd b.mmd c.mmd -o ./out   # batch → ./out/*.vsdx
vas render flow.mmd -f svg              # → flow.svg
vas render flow.mmd -f png --dpi 1200   # high-res PNG
vas render flow.mmd --theme dark
```

| Option | Meaning | Default |
|--------|---------|---------|
| `-o, --out` | output file (single) or directory (batch) | next to input |
| `-f, --format` | `vsdx` \| `svg` \| `png` | `vsdx` |
| `-t, --theme` | `default` \| `neutral` \| `dark` \| `forest` \| `base` | `default` |
| `--dpi` | PNG resolution | `720` |
| `--title` | Visio document title | input file name |

## Serve (web-API primitive for automation)

Keep one warm headless renderer behind a tiny HTTP API — ideal for CI, batch jobs,
or wiring into an automated documentation pipeline:

```bash
vas serve --port 4477
```

```bash
# POST Mermaid source, get a file back
curl -X POST --data-binary @diagram.mmd \
  "http://127.0.0.1:4477/render?format=vsdx&title=My%20Diagram" \
  -o diagram.vsdx

curl -X POST --data-binary @flow.mmd \
  "http://127.0.0.1:4477/render?format=png&dpi=1200" -o flow.png
```

| Route | Description |
|-------|-------------|
| `POST /render?format=vsdx\|svg\|png[&theme=&dpi=&title=]` | body = Mermaid source → file bytes |
| `GET /health` | liveness check |

Calls are serialized (one headless page). Bind to `127.0.0.1` by default; expose
it only behind your own auth/proxy.

## Offline / air-gapped

Puppeteer's Chromium and the `mermaid` package both come from the public network
at install time. Once installed, rendering is fully local — no diagram content
leaves the machine.

## License

MIT © Klyra, AI-Enhanced Strategic Intelligence, Inc. — see [LICENSE](LICENSE).
"Microsoft" and "Visio" are trademarks of Microsoft Corporation; not affiliated.
