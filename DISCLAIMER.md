# Disclaimer

This project ("the Software") is published by **Klyra, AI-Enhanced Strategic
Intelligence, Inc.** ("Klyra", https://klyra.tech) as free, open-source software
under the [MIT License](LICENSE).
This document restates and expands the limitations already contained in that
license. In case of any conflict, the MIT License governs the grant of rights;
this document does not add obligations to, or restrict, the rights granted there.

> **Not legal advice.** This document is provided for transparency. It is not
> legal advice, and adopters should consult their own counsel before relying on
> the Software in any regulated, safety-critical, or commercial context.

## 1. No warranty — provided "AS IS"

The Software is provided "AS IS" and "AS AVAILABLE", without warranty of any
kind, express, implied, or statutory, including but not limited to the implied
warranties of merchantability, fitness for a particular purpose,
non-infringement, accuracy, reliability, availability, or that the Software is
free of errors, defects, or harmful components. You use the Software entirely at
your own risk.

## 2. Limitation of liability

To the maximum extent permitted by applicable law, in no event shall Klyra
Technologies, its affiliates, officers, employees, contributors, or licensors be
liable for any claim, damages, or other liability — whether direct, indirect,
incidental, special, exemplary, consequential, or punitive (including but not
limited to loss of profits, revenue, data, goodwill, or business interruption) —
arising from, out of, or in connection with the Software or the use of or
inability to use it, whether in contract, tort (including negligence), strict
liability, or any other legal theory, even if advised of the possibility of such
damages.

## 3. Not professional architecture, engineering, or other advice

The Software helps produce **draft** enterprise- and solution-architecture
diagrams and related artifacts. Its outputs are **starting points for human
review**, not finished professional deliverables. Nothing the Software produces
constitutes professional architecture, engineering, security, legal, financial,
medical, or other expert advice. **A qualified professional must review and
validate any output before it is relied upon for decisions, designs, contracts,
or deployments.** You are solely responsible for the suitability and consequences
of any artifact you derive from the Software.

## 4. AI- and LLM-generated content

The recommended workflow uses third-party Large Language Models (LLMs) to turn
meeting transcripts into diagrams, and portions of this codebase may have been
generated or assisted by AI tools. AI systems can produce output that is
incorrect, incomplete, biased, fabricated ("hallucinated"), or out of date.
Klyra does not control and is not responsible for any third-party AI
service or its output. **You must independently verify all AI-generated content**
before use. Your use of any third-party AI service is governed by that provider's
own terms and privacy policy, not by this project.

## 5. Conversion fidelity (SVG / PNG / Visio .vsdx)

The Software converts rendered diagrams into other formats, including
Microsoft Visio `.vsdx`. While it aims to reproduce the on-screen preview
faithfully, **exact visual or structural fidelity across formats and software
versions is not guaranteed.** Always review exported files in their target
application before depending on them.

## 6. Security

No software is perfectly secure. Klyra makes no guarantee that the
Software is free of vulnerabilities. You are responsible for the security of the
environment in which you run, host, or deploy the Software, including access
controls, network exposure, and keeping dependencies up to date. To report a
suspected vulnerability, see [SECURITY.md](SECURITY.md).

## 7. Data and privacy

The editor is designed to run entirely in the user's browser; diagram content
processed by the editor itself is not transmitted by the Software. **However, the
broader workflow may involve sending transcripts or diagram content to
third-party services (for example, an LLM or a transcription service).** Do not
submit confidential, personal, regulated, or otherwise sensitive information to
any third-party service unless you have confirmed it is appropriate and permitted
to do so. You are solely responsible for your handling of data.

## 8. Third-party components — and Mermaid is not included

**This project does not include, bundle, or redistribute Mermaid or any copy of
its source code.** The Software is only the Visio-export *extension* plus editor
and tooling. To use it you obtain the **official, public Mermaid** engine
yourself — from its CDN, the npm registry, or your own self-hosted copy — and your
use of Mermaid is governed solely by **Mermaid's own license and terms**, not by
this project. The same applies to other third-party components you install (for
example, a headless browser used by the CLI). Klyra makes no warranty regarding,
and accepts no liability for, Mermaid or any other third-party component. See
[THIRD-PARTY-NOTICES](visio-as-script/THIRD-PARTY-NOTICES.md) for attribution.

## 9. Trademarks and non-affiliation

"Microsoft" and "Visio" are trademarks of Microsoft Corporation; "Mermaid" and
other names are the property of their respective owners. This project is **not
affiliated with, sponsored by, or endorsed by** Microsoft, the Mermaid project,
or any other third party. References to such names describe interoperability or
attribution only.

## 10. Compliance, export, and acceptable use

You are responsible for ensuring that your use of the Software complies with all
applicable laws and regulations, including data-protection, intellectual-property,
and export-control laws. Do not use the Software for any unlawful purpose.

## 11. No obligation to support or maintain

The Software is provided without any commitment to support, maintain, update, or
correct it. Roadmap items, if any, are aspirational and may change or be removed
at any time without notice.

## 12. Your responsibility

By using the Software you acknowledge and agree that you do so at your own
discretion and risk, that you are solely responsible for any resulting damage or
loss, and that you will not hold Klyra responsible for outcomes
arising from your use of the Software or any artifact derived from it.
