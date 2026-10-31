/**
 * Markets or series we deliberately do not cover, and why (BUILD_SPEC §1: show the gap, never
 * estimate). Shown on /data. Update this list when a source is added or a gap is closed.
 */

export type GapMarket = "gas" | "lng" | "crude" | "products" | "power";

export interface DeclaredGap {
  title: string;
  reason: string;
  markets: GapMarket[];
}

export const DECLARED_GAPS: DeclaredGap[] = [
  {
    title: "Daily European hub gas prices (TTF, NBP, THE, PEG)",
    reason:
      "Exchange prices (ICE Endex, EEX) are licensed and not redistributed. Europe is covered by the IMF monthly benchmark, and daily TTF indicators come from the unofficial NYMEX Dutch TTF contract (front month and M1–M2 spread, labelled). NBP, THE and PEG have no free daily price.",
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
    title: "ICE Brent and ICE gasoil futures prices",
    reason:
      "Licensed exchange data. Brent and diesel prices come from EIA spot assessments; curve structure comes from unofficial NYMEX contracts (WTI, the Brent Last Day look-alike, NY Harbor ULSD, RBOB), shown as spreads only.",
    markets: ["crude", "products"],
  },
  {
    title: "Dated Brent, Dubai, Oman and Urals assessments",
    reason:
      "Physical crude assessments (Platts, Argus) are licensed. Brent is shown with the EIA spot price; Middle East and Russian grades are not covered.",
    markets: ["crude"],
  },
  {
    title: "IEA and OPEC monthly oil market reports",
    reason:
      "The IEA Oil Market Report is paid, and OPEC's secondary-source production tables cannot be republished. The world balance and OPEC capacity shown are EIA's STEO estimates (public domain).",
    markets: ["crude"],
  },
  {
    title: "Crude and product stocks outside the US (OECD, ARA, Fujairah, Singapore, China)",
    reason:
      "Weekly ARA stocks (Insights Global) and Fujairah data are licensed or not redistributable; OECD and Chinese stocks are monthly or unofficial. Only US weekly stocks (EIA) are shown.",
    markets: ["crude", "products"],
  },
  {
    title: "Brent and ICE gasoil positioning (Commitments of Traders)",
    reason:
      "ICE publishes it, but its terms forbid republication without written permission. CFTC positioning is shown for NYMEX WTI, RBOB and NY Harbor ULSD.",
    markets: ["crude", "products"],
  },
  {
    title: "North-West Europe cracks and wholesale product prices",
    reason:
      "NWE diesel, gasoline and jet cargo prices (Platts, Argus) and ICE gasoil are licensed. European refining margins are therefore not shown; EU pump prices (with and without taxes) come from the Commission's Weekly Oil Bulletin.",
    markets: ["products"],
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
