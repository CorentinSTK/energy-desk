/**
 * WCAG AA contrast check for the design tokens, in both themes (BUILD_SPEC §8).
 * Text tokens and commodity colours (also used as text labels) must reach 4.5:1 on every background.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../src/styles/tokens.css"), "utf8");

/** Hex custom properties declared in the first block whose selector list matches `selector`. */
function tokens(selector: RegExp): Record<string, string> {
  const block = css.match(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`));
  if (!block) throw new Error(`No token block for ${selector}`);
  const entries = [...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)];
  return Object.fromEntries(entries.map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = {
  light: tokens(/:root,\s*\.light/),
  dark: tokens(/\.dark/),
};

const BACKGROUNDS = ["background", "surface", "surface-raised", "muted"];
const FOREGROUNDS = [
  "foreground",
  "text-secondary",
  "muted-foreground",
  "primary",
  "positive",
  "negative",
  "warning",
  "c-crude",
  "c-products",
  "c-natgas",
  "c-lng",
  "c-lpg",
  "c-power",
];
const AA_TEXT = 4.5;

describe.each(Object.entries(THEMES))("%s theme", (_name, t) => {
  it("defines every token checked here", () => {
    for (const key of [...BACKGROUNDS, ...FOREGROUNDS, "primary-foreground"]) {
      expect(t[key], key).toMatch(/^#/);
    }
  });

  for (const fg of FOREGROUNDS) {
    for (const bg of BACKGROUNDS) {
      it(`${fg} on ${bg} ≥ ${AA_TEXT}:1`, () => {
        expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  it("primary-foreground on primary ≥ 4.5:1", () => {
    expect(contrast(t["primary-foreground"], t.primary)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
