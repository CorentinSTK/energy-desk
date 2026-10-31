import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * The image shown when a link to the site is shared (LinkedIn, Slack…). Generated at build time,
 * with no external service. The image renderer cannot read CSS variables, so the colours below
 * copy the dark theme of src/styles/tokens.css; keep them in step.
 */
const DARK = {
  background: "#0b0f14",
  border: "#263241",
  foreground: "#e6edf3",
  textSecondary: "#a9b4c2",
  markets: ["#39c5cf", "#5b9cf5", "#b392f0", "#d6a56b", "#f0883e"],
};
const MARKETS = ["Gas", "LNG", "Power", "Crude", "Products"];

export const alt = `${SITE_NAME}: ${SITE_DESCRIPTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: DARK.background,
        color: DARK.foreground,
        borderBottom: `12px solid ${DARK.border}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 38, color: DARK.textSecondary, maxWidth: 900 }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {MARKETS.map((market, i) => (
          <div
            key={market}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 30,
              padding: "10px 22px",
              border: `2px solid ${DARK.border}`,
              borderRadius: 999,
            }}
          >
            <div
              style={{ width: 16, height: 16, borderRadius: 999, background: DARK.markets[i] }}
            />
            {market}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
