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
    title: "Power forward curves and intraday auctions",
    reason:
      "Power futures (EEX, ICE Endex) and exchange intraday data (EPEX SPOT) are licensed. Day-ahead auction prices (DE-LU, France) and the GB market index are shown instead.",
    markets: ["power"],
  },
  {
    title: "GB day-ahead auction price",
    reason:
      "The N2EX and EPEX GB day-ahead auction results are licensed. Great Britain is shown with the Elexon market index (MID), an index of short-term trades, labelled as such and never put in a spread with continental auction prices.",
    markets: ["power"],
  },
  {
    title: "GB embedded solar and wind",
    reason:
      "Elexon reports transmission-connected generation only. Most British solar is connected to distribution networks, so it is missing from the GB generation mix, and GB demand (INDO) excludes demand met by it.",
    markets: ["power"],
  },
  {
    title: "Clean spark and dark spreads",
    reason:
      "They need a daily gas price and a carbon price of the same kind as the power price. The only daily gas price available is a futures contract (unofficial), and no free EUA price is confirmed, so mixing them with spot power would break the like-for-like rule.",
    markets: ["power"],
  },
  {
    title: "EUA carbon price",
    reason: "No free, redistributable daily source confirmed yet.",
    markets: ["power"],
  },
];
