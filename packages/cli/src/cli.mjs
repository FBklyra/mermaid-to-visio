#!/usr/bin/env node
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
// vas — Visio-as-Script CLI. Convert Mermaid → native Visio (.vsdx), SVG, or PNG,
// headlessly, and expose an HTTP endpoint for automated pipelines.
//
// Uses the OFFICIAL public Mermaid (an npm dependency). Ships no copy of Mermaid.

import fs from 'node:fs';
import path from 'node:path';
import { createRenderer } from './renderer.mjs';
import { startServer } from './serve.mjs';

const EXT = { vsdx: '.vsdx', svg: '.svg', png: '.png' };

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else if (a.startsWith('-') && a.length === 2) {
      const map = { o: 'out', f: 'format', t: 'theme' };
      const key = map[a[1]] || a[1];
      flags[key] = argv[++i];
    } else positional.push(a);
  }
  return { positional, flags };
}

const HELP = `vas — Visio-as-Script CLI

USAGE
  vas render <input.mmd...> [options]
  vas serve [options]
  vas help | --version

RENDER OPTIONS
  -o, --out <path>      Output file (single input) or directory (multiple inputs)
  -f, --format <fmt>    vsdx | svg | png            (default: vsdx)
  -t, --theme <name>    default | neutral | dark | forest | base
      --dpi <n>         PNG resolution               (default: 720)
      --title <text>    Visio document title         (default: file name)

SERVE OPTIONS (HTTP endpoint for pipelines)
  --port <n>            Port                          (default: 4477)
  --host <addr>         Bind address                  (default: 127.0.0.1)

EXAMPLES
  vas render diagram.mmd                      # → diagram.vsdx
  vas render diagram.mmd -o out.vsdx
  vas render a.mmd b.mmd c.mmd -o ./out -f svg
  vas render flow.mmd -f png --dpi 1200
  vas serve --port 4477
    # then:  curl -X POST --data-binary @diagram.mmd \\
    #          "http://127.0.0.1:4477/render?format=vsdx" -o diagram.vsdx

Mermaid is the official public engine (an npm dependency). No copy of Mermaid is
bundled. See https://github.com/FBklyra/mermaid-to-visio`;

async function cmdRender(positional, flags) {
  if (positional.length === 0) { console.error('error: no input files. See `vas help`.'); process.exit(1); }
  const format = String(flags.format || 'vsdx').toLowerCase();
  if (!EXT[format]) { console.error(`error: unknown format "${format}". Use vsdx|svg|png.`); process.exit(1); }

  const multi = positional.length > 1;
  const opts = { theme: flags.theme, dpi: flags.dpi ? Number(flags.dpi) : undefined };

  const renderer = await createRenderer();
  try {
    for (const input of positional) {
      const def = fs.readFileSync(input, 'utf8');
      const baseTitle = flags.title || path.basename(input, path.extname(input));
      const out = resolveOut(input, flags.out, format, multi);
      fs.mkdirSync(path.dirname(out), { recursive: true });

      let result;
      if (format === 'vsdx') result = await renderer.renderVsdx(def, { ...opts, title: baseTitle });
      else if (format === 'svg') result = await renderer.renderSvg(def, opts);
      else result = await renderer.renderPng(def, opts);

      fs.writeFileSync(out, result.bytes);
      const extra = result.stats ? `  (${result.stats.shapes} shapes, ${result.stats.texts} texts)` : '';
      console.log(`  ${input} → ${out}${extra}`);
    }
  } finally {
    await renderer.close();
  }
}

function resolveOut(input, outFlag, format, multi) {
  const ext = EXT[format];
  const base = path.basename(input, path.extname(input)) + ext;
  if (!outFlag) return path.join(path.dirname(input), base);
  if (multi) return path.join(String(outFlag), base); // out is a directory
  // single input: if out looks like a directory, write base into it
  if (typeof outFlag === 'string' && (outFlag.endsWith('/') || outFlag.endsWith('\\') || fs.existsSync(outFlag) && fs.statSync(outFlag).isDirectory())) {
    return path.join(outFlag, base);
  }
  return String(outFlag);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { console.log(HELP); return; }
  if (cmd === '--version' || cmd === '-v') {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
    console.log(pkg.version);
    return;
  }

  const { positional, flags } = parseArgs(argv.slice(1));
  if (cmd === 'render') return cmdRender(positional, flags);
  if (cmd === 'serve') return startServer(flags);

  console.error(`error: unknown command "${cmd}". See \`vas help\`.`);
  process.exit(1);
}

main().catch((e) => { console.error('error:', e.message || e); process.exit(1); });
