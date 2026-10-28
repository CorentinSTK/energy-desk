/**
 * Markets or series we deliberately do not cover, and why (BUILD_SPEC §1: show the gap, never
 * estimate). Shown on /data. Update this list when a source is added or a gap is closed.
 */

export type GapMarket = "gas" | "lng" | "crude" | "power";

export interface DeclaredGap {
  title: string;
  reason: string;
  markets: GapMarket[];
}

export const DECLARED_GAPS: DeclaredGap[] = [
  {
    title: "Daily European hub gas prices (TTF, NBP, THE, PEG)",
    reason:
      "Exchange prices (ICE Endex, EEX) are licensed and not redistributed. Europe is covered by the IMF monthly benchmark; daily TTF indicators from unofficial futures data come in a later milestone.",
    markets: ["gas"],
  },
  {
    title: "UK gas storage and UK LNG terminals",
    reason: "GIE AGSI+ and ALSI have published no UK data since Brexit.",
    markets: ["gas", "lng"],
  },
  {
    title: "Norwegian pipeline flows into Germany (Emden, Dornum)",
    reason:
      "ENTSOG reports these points under several operators with overlapping values. Adding them up would double count, so they are not shown until a reliable reconciliation exists. Norwegian flows into France and Belgium are shown.",
    markets: ["gas"],
  },
  {
    title: "European gas positioning (TTF Commitments of Traders)",
    reason:
      "ICE publishes it, but its terms forbid republication without written permission. The CFTC does not cover TTF.",
    markets: ["gas"],
  },
  {
    title: "ICE Brent and ICE gasoil prices",
    reason:
      "Licensed exchange data. Brent is covered by the EIA spot assessment; futures indicators come from unofficial NYMEX look-alike contracts in a later milestone.",
    markets: ["crude"],
  },
  {
    title: "LNG prices (JKM, delivered North-West Europe)",
    reason: "Delivered LNG prices are licensed assessments; no free redistributable source exists.",
    markets: ["lng"],
  },
  {
    title: "LNG cargoes by origin",
    reason:
      "Cargo-level data comes from licensed ship-tracking services. Terminal send-out into the grid is shown instead.",
    markets: ["lng"],
  },
  {
    title: "EUA carbon price",
    reason: "No free, redistributable daily source confirmed yet.",
    markets: ["power"],
  },
];
