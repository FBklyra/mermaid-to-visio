# Visio-as-Script — Solution Architecture & Azure Cost Analysis

> Internal engineering reference. An open-source extension of Mermaid that turns
> Mermaid diagram scripts into live SVG previews and one-click exports to **SVG**,
> **high-resolution PNG**, and **native Visio (`.vsdx`)** — running entirely in
> the browser and deployable to the corporate intranet on a small Azure host.

| | |
|---|---|
| **Document** | Solution Architecture & Cost Analysis |
| **Component** | `visio-as-script` web editor |
| **Status** | Draft for review |
| **Audience** | Enterprise & Solution Architects, Platform Engineering |

---

## 1. Solution overview

`visio-as-script` is a single-page web application styled after *mermaid.live*,
with the capability *mermaid.live cannot offer*: **export to native Visio**.

Architecturally significant characteristics:

- **100 % client-side conversion.** Mermaid's layout engine needs a DOM
  (`getBBox`). In a browser the DOM already exists, so `mermaid.render()` and
  `mermaid.renderToVisio()` run in the user's tab. No server-side rendering, no
  headless browser, **no diagram data leaves the client**.
- **Ships only the extension.** The app bundles **no copy of Mermaid**; the
  browser loads the official public Mermaid from a CDN (or a self-hosted copy for
  offline use). Only the Visio-export extension is local. The server is a
  zero-dependency static file server.
- **Identical fidelity across formats.** SVG, PNG and `.vsdx` come from the *same*
  render pass, so the Visio object distribution matches the on-screen SVG exactly.

---

## 2. Architecture views

Three formal views accompany this document, authored as Mermaid scripts and
intended to be exported to Visio with this very tool:

| View | File | Concern | Audience |
|------|------|---------|----------|
| **Conceptual** | `01-conceptual.mmd` | *What* the solution does — capabilities, actors, value. Technology-free. | Business & Enterprise Architecture |
| **Logical** | `02-logical.mmd` | *How* it is structured — components, tiers and data flow. Technology-aware, deployment-agnostic. | Solution Architecture |
| **Physical** | `03-physical.mmd` | *Where* it runs — concrete Azure resources, networking, CI/CD. | Platform Engineering / Ops |

### Title block convention

Every diagram begins with a **title-block holder** — the first node in the
script — carrying *Company name, Unit name, Diagram title, Version, Date*. Edit
those placeholder (`«…»`) values before publishing. The block is styled small but
legible and anchored to the top of the canvas; because Mermaid uses automatic
layout (no absolute positioning), nudge it to the exact top-right corner in Visio
after export.

---

## 3. Deployment options — Docker vs. "web server"

A common misconception: *"Docker vs. web server"* is **not** the main cost lever.
On Azure App Service your Docker image runs on the **same plan** that a plain Node
web app does — identical price. The real cost drivers are **(1) the plan tier**
and **(2) whether you need private (intranet-only) inbound networking**.

The application is exceptionally light to host: no database, no server-side
rendering, no headless browser, near-idle CPU/RAM. A 1-core / 1.75 GB instance is
already oversized.

---

## 4. Azure cost analysis

> ⚠️ Figures are **approximate, pay-as-you-go, US regions, ~2025**, and exclude
> egress and any EA/CSP discount your organization holds. Validate in the
> [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/).

| Option | What runs | ~Monthly (always-on) | Private networking | Notes |
|---|---|---|---|---|
| **App Service B1 — plain Node** ("web server") | `node server.js` | **~$13** | VNet integration ✓ | No registry needed. Simplest. |
| **App Service B1 — Docker image** | the container | **~$13 + ~$5 ACR ≈ $18** | VNet integration ✓ | Same plan, plus a registry. |
| **Azure Container Apps** | the container | **~$0–15** | Internal env ✓ (native private VNet) | **Scales to zero** → near-free when idle. + ~$5 ACR. |
| **Azure Container Instances (ACI)** | the container | **~$35** + ~$5 ACR | VNet ✓ | No scale-to-zero, no orchestration. Avoid for always-on. |
| **AKS** | the container | **$70+** (cluster + nodes) | ✓ | Overkill for this workload. |

**Supporting services (Docker paths):**

- **Azure Container Registry (Basic):** ~$5/month to store the image.
- **Private Endpoint** (app reachable *only* on the intranet, no public hostname):
  ~$7/month + small data-processing charges, and historically requires
  **Standard tier (~$70/month)** or higher on App Service. **This is usually the
  single biggest swing in the bill.**

### The decisive question

> Does the app need to be **unreachable from the public internet** (a private
> *inbound* endpoint), or is it enough to sit **on the VNet with access
> restrictions**?

That one answer separates **~$13–18/month** from **~$70+/month** — it matters far
more than Docker-vs-Node.

---

## 5. Recommendation

| Scenario | Recommendation | ~Monthly |
|---|---|---|
| Private **VNet** access is sufficient | **App Service B1** + Docker image | **~$18** |
| Idle most of the day, want it **fully private** | **Container Apps** internal environment (scale-to-zero) | **~$5–15** |
| Avoid | ACI (pricier always-on), AKS (overkill) | — |

The chosen target for this solution is a **Docker container** (see
`03-physical.mmd`), giving portability across App Service for Containers,
Container Apps, and ACI from a single image in Azure Container Registry.

---

## 6. Reference deployment (Docker → Azure)

```bash
# 1. Vendor the engine into the project (one-time / after a Mermaid rebuild)
npm run vendor

# 2. Build straight into Azure Container Registry (no local Docker required)
RG=rg-diagrams; ACR=myacr; APP=visio-as-script; PLAN=plan-diagrams
az acr create  -g $RG -n $ACR --sku Basic
az acr build   -r $ACR -t visio-as-script:latest .

# 3a. Host on a small Linux App Service (Basic B1)
az appservice plan create -g $RG -n $PLAN --is-linux --sku B1
az webapp create -g $RG -p $PLAN -n $APP \
  --deployment-container-image-name $ACR.azurecr.io/visio-as-script:latest
az webapp config appsettings set -g $RG -n $APP --settings WEBSITES_PORT=8080

# 3b. …or Container Apps (internal/private, scale-to-zero) — point it at the
#     same $ACR.azurecr.io/visio-as-script image; the port is read from EXPOSE.
```

The container listens on **8080** (`ENV PORT` / `EXPOSE`); `WEBSITES_PORT=8080`
tells App Service which port to route to. Restrict access via VNet integration,
private endpoint, or App Service access restrictions per your intranet policy.
