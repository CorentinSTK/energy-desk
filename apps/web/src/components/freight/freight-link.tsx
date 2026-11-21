import Link from "next/link";

/** Cross-link from the oil and LNG flow tabs to the chokepoints and routes on the freight page. */
export function FreightLink({ cargo }: { cargo: "oil" | "LNG" }) {
  return (
    <p className="text-sm text-text-secondary">
      Seaborne {cargo}: tanker transits through Hormuz, Bab el-Mandeb, Suez and the other
      chokepoints, and voyage times via Suez, Panama or the Cape, are on the{" "}
      <Link href="/markets/freight" className="text-primary underline underline-offset-2">
        freight page
      </Link>
      .
    </p>
  );
}
