/**
 * Markets or series we deliberately do not cover, and why (BUILD_SPEC §1: show the gap, never
 * estimate). Shown on /data. Update this list when a source is added or a gap is closed.
 */

export type GapMarket = "gas" | "lng" | "crude" | "products" | "lpg" | "power" | "freight";

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
    title: "Load, generation and plant outages outside the open sources",
    reason:
      "ENTSO-E publishes load, generation per type and plant unavailability for every zone, but these items are not on its list of data free for re-use (only grid data such as physical flows is, under CC BY 4.0). They are therefore not republished here. Germany, France and Great Britain are covered by SMARD, RTE and Elexon. French nuclear availability has no open daily source confirmed yet; French nuclear output (RTE) is shown instead.",
    markets: ["power"],
  },
  {
    title: "Official EUA carbon price",
    reason:
      "EEX publishes EU ETS auction results and Commitments of Traders, but its terms forbid republication without written approval; public display needs a paid Media Usage licence (checked 25 Nov 2026). The European Commission links to EEX and publishes no prices itself. The power page shows an unofficial proxy instead: the price of an exchange-traded product backed by EUAs (Yahoo Finance).",
    markets: ["power"],
  },
  {
    title: "European and Asian LPG prices",
    reason:
      "Northwest Europe propane, the Argus Far East Index and Saudi Aramco contract prices are licensed price assessments (Argus, Platts) or are not published for reuse. The LPG page shows the free US benchmark, Mont Belvieu propane (EIA).",
    markets: ["lpg"],
  },
  {
    title: "European LPG stocks and demand",
    reason:
      "No free weekly source. Monthly national statistics exist (Eurostat, JODI) but are not added yet. US stocks and demand (EIA weekly) are shown.",
    markets: ["lpg"],
  },
  {
    title: "Propane and butane futures",
    reason:
      "NYMEX and ICE propane futures prices are licensed exchange data, and no free official source publishes them. Only spot prices are shown; positioning (CFTC) is in the Positioning tab.",
    markets: ["lpg"],
  },
  {
    title: "Tanker and LNG carrier freight rates",
    reason:
      "Route assessments (Baltic Exchange TD and TC routes, Worldscale flat rates, Clarksons time-charter rates) are licensed and not redistributed. The freight page shows what is free: transits through the chokepoints (IMF PortWatch) and computed distances and days at sea.",
    markets: ["freight"],
  },
  {
    title: "Bunker fuel prices",
    reason:
      "Marine fuel prices (VLSFO, HSFO, LNG bunkers at Singapore, Rotterdam, Fujairah) are licensed price assessments. Without them, voyage costs are not computed: only distances and days at sea are shown.",
    markets: ["freight"],
  },
  {
    title: "Vessel-level tracking (cargo origin, destination, ship names)",
    reason:
      "Raw AIS positions and cargo-level trade flows come from licensed ship-tracking services. PortWatch publishes daily counts per chokepoint, derived from AIS, which is what the freight page shows.",
    markets: ["freight", "lng", "crude"],
  },
];
