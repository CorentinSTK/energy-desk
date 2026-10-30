/**
 * The benchmark strip on the home page: one price per market, each labelled with its price type and
 * source, so a spot price, an auction, an index, a futures contract and a retail price are never
 * mistaken for one another (BUILD_SPEC §4).
 */

export interface Benchmark {
  code: string;
  label: string;
  /** Price type and source, shown under the value. */
  kind: string;
  href: string;
}

export const BENCHMARKS: Benchmark[] = [
  { code: "eia.brent_spot", label: "Brent", kind: "Spot · EIA", href: "/markets/crude" },
  { code: "eia.wti_spot", label: "WTI", kind: "Spot · EIA", href: "/markets/crude" },
  {
    code: "yahoo.ttf.front_month",
    label: "TTF front month",
    kind: "NYMEX futures · unofficial",
    href: "/markets/gas",
  },
  {
    code: "smard.de_lu.price_da_base",
    label: "DE-LU power",
    kind: "Day-ahead base · SMARD",
    href: "/markets/power",
  },
  {
    code: "smard.fr.price_da_base",
    label: "France power",
    kind: "Day-ahead base · SMARD",
    href: "/markets/power?zone=fr",
  },
  {
    code: "elexon.gb.mid_base",
    label: "GB power",
    kind: "Market index · Elexon",
    href: "/markets/power?zone=gb",
  },
  { code: "eia.henry_hub_spot", label: "Henry Hub", kind: "Spot · EIA", href: "/markets/gas" },
  {
    code: "ec_wob.eu.diesel.with_tax",
    label: "EU diesel",
    kind: "Pump price, weekly · EC",
    href: "/markets/products",
  },
];
