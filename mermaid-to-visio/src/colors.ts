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
/**
 * Colour normalization to Visio's `#RRGGBB` form.
 *
 * Handles hex (#rgb / #rrggbb) and `rgb()/rgba()`. Returns undefined for
 * `none`/`transparent`/unparseable so callers can treat the element as having no
 * fill or no stroke.
 */
export function normalizeColor(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const v = value.trim().toLowerCase();
  if (v === '' || v === 'none' || v === 'transparent') {
    return undefined;
  }
  if (/^#[0-9a-f]{6}$/.test(v)) {
    return v.toUpperCase();
  }
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toUpperCase();
  }
  const m = v.match(/^rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((s) => parseFloat(s));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      // rgba alpha 0 → fully transparent → treat as no paint.
      if (parts.length >= 4 && parts[3] === 0) {
        return undefined;
      }
      return (
        '#' +
        parts
          .slice(0, 3)
          .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
          .join('')
      ).toUpperCase();
    }
  }
  return undefined;
}
