/**
 * Markets or series we deliberately do not cover, and why (BUILD_SPEC §1: show the gap, never
 * estimate). Shown on /data. Update this list when a source is added or a gap is closed.
 */

export interface DeclaredGap {
  title: string;
  reason: string;
}

export const DECLARED_GAPS: DeclaredGap[] = [
  {
    title: "Daily European hub gas prices (TTF, NBP, THE, PEG)",
    reason:
      "Exchange prices (ICE Endex, EEX) are licensed and not redistributed. Europe is covered by the IMF monthly benchmark; daily TTF indicators from unofficial futures data come in a later milestone.",
  },
  {
    title: "UK gas storage and UK LNG terminals",
    reason: "GIE AGSI+ and ALSI have published no UK data since Brexit.",
  },
  {
    title: "Norwegian pipeline flows into Germany (Emden, Dornum)",
    reason:
      "ENTSOG reports these points under several operators with overlapping values. Adding them up would double count, so they are not shown until a reliable reconciliation exists. Norwegian flows into France and Belgium are shown.",
  },
  {
    title: "European gas positioning (TTF Commitments of Traders)",
    reason:
      "ICE publishes it, but its terms forbid republication without written permission. The CFTC does not cover TTF.",
  },
  {
    title: "ICE Brent and ICE gasoil prices",
    reason:
      "Licensed exchange data. Brent is covered by the EIA spot assessment; futures indicators come from unofficial NYMEX look-alike contracts in a later milestone.",
  },
  {
    title: "EUA carbon price",
    reason: "No free, redistributable daily source confirmed yet.",
  },
];
