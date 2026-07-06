# Security Policy

Thank you for helping keep this project and its users safe.

## Scope

This is a **client-side** application: the editor renders Mermaid and exports
SVG / PNG / Visio `.vsdx` entirely in the browser, with no backend service and no
upload of diagram content by the Software itself. The most relevant security
considerations are therefore:

- Cross-site scripting (XSS) or code execution via crafted diagram input.
- Issues in how the Software builds export files (`.vsdx`, `.pptx`).
- Vulnerabilities in bundled third-party components (e.g. Mermaid).
- Misconfiguration guidance for self-hosting (Docker / IIS / static host).

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.**

Instead, report privately via either:

- GitHub's **private vulnerability reporting** ("Report a vulnerability" under the
  repository's **Security** tab), or
- email **security@klyra.tech** with the details.

Please include: a description of the issue, steps to reproduce (a minimal Mermaid
input or file is ideal), the impact you foresee, and any suggested remediation.

### What to expect

- Acknowledgement of your report as soon as we reasonably can.
- An assessment and, where warranted, a fix in a future release.
- Credit for responsible disclosure if you would like it.

This is an open-source project maintained by **Klyra, AI-Enhanced Strategic
Intelligence, Inc.** ("Klyra") on a
best-effort basis. There is no service-level commitment and no bug-bounty
program. See [DISCLAIMER.md](DISCLAIMER.md) for the limits of liability.

## Supported versions

Security fixes, when made, target the latest `main`. Older snapshots are not
maintained.

## For self-hosters

- Serve the app over HTTPS and restrict access appropriately (it is intended as
  an internal tool — see the deployment notes for Docker/Azure and IIS).
- Keep the bundled Mermaid engine current by re-vendoring after upstream updates.
- Treat any transcript or diagram content you route to third-party AI or
  transcription services according to your own data-handling policy.
