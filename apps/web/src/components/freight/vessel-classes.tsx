"use client";

import { useState } from "react";

import { COMMODITIES, type Commodity } from "@/lib/commodities";
import {
  type CommodityFleet,
  FLEETS,
  formatCapacity,
  type HullShape,
  relativeSize,
  type VesselCommodity,
} from "@/lib/freight/vessels";
import { cn } from "@/lib/utils";

/** Site colour of each group: the commodity colours used everywhere else. */
const COLOUR: Record<VesselCommodity, Commodity> = {
  crude: "crude",
  products: "products",
  lng: "lng",
  lpg: "lpg",
};

/** Delay between two ships sailing in, in ms. */
const STAGGER_MS = 90;

/**
 * Side view of a ship, bow to the right, drawn for this site (not a real vessel): hull in the
 * commodity colour, accommodation aft, and the deck that tells the type apart — pipework on a tanker,
 * a raised trunk deck on a membrane LNG carrier, tank domes on a gas carrier.
 */
function Silhouette({ shape, colourVar }: { shape: HullShape; colourVar: string }) {
  const line = { stroke: "var(--border-strong)", strokeWidth: 0.7 };
  return (
    <svg viewBox="0 0 200 32" className="block h-auto w-full" aria-hidden>
      {/* Hull: flat bottom, raked bow, square stern; deck at y = 19. */}
      <path d="M2 19 L5 29 L185 29 Q194 27 199 18.5 L2 18.5 Z" fill={`var(${colourVar})`} />
      {/* Boot topping: the darker band at the waterline. */}
      <path
        d="M4.2 26 L189 26 Q192.5 24.5 194.5 22 L196 22.5 Q192 28 185 29 L5 29 Z"
        fill="var(--foreground)"
        opacity="0.22"
      />
      {/* Accommodation block, bridge windows and funnel, aft. */}
      <rect x="8" y="8.5" width="18" height="10.5" rx="1" fill="var(--surface-raised)" {...line} />
      <rect x="10" y="10.3" width="14" height="1.5" rx="0.5" fill="var(--border-strong)" />
      <rect
        x="12.5"
        y="4.5"
        width="6"
        height="4.5"
        rx="1"
        fill="var(--foreground)"
        opacity="0.65"
      />
      {shape === "tanker" && (
        <g stroke="var(--foreground)" strokeOpacity="0.4" strokeWidth="0.7" fill="none">
          <line x1="30" y1="17.6" x2="186" y2="17.6" />
          <line x1="30" y1="16.4" x2="186" y2="16.4" />
          <line x1="105" y1="13" x2="105" y2="18.5" />
          <line x1="101" y1="13" x2="109" y2="13" />
        </g>
      )}
      {shape === "membrane" && (
        <rect
          x="30"
          y="14"
          width="152"
          height="5"
          rx="1.5"
          fill="var(--surface-raised)"
          {...line}
        />
      )}
      {shape === "gas" &&
        [50, 84, 118, 152].map((x) => (
          <ellipse
            key={x}
            cx={x}
            cy="18.5"
            rx="13"
            ry="3.6"
            fill="var(--surface-raised)"
            {...line}
          />
        ))}
      {/* Foremast. */}
      <line
        x1="190"
        y1="9"
        x2="190"
        y2="18.5"
        stroke="var(--foreground)"
        strokeOpacity="0.55"
        strokeWidth="0.9"
      />
    </svg>
  );
}

function Fleet({ fleet }: { fleet: CommodityFleet }) {
  const colour = COMMODITIES[COLOUR[fleet.id]];
  return (
    <ol className="space-y-5">
      {fleet.classes.map((vessel, index) => {
        const size = relativeSize(fleet, vessel);
        return (
          <li
            key={vessel.id}
            className="grid animate-in gap-x-6 gap-y-2 duration-500 fade-in slide-in-from-left-8 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-end"
            style={{ animationDelay: `${index * STAGGER_MS}ms`, animationFillMode: "both" }}
          >
            <div className="relative flex max-w-2xl items-end pb-3">
              {/* Sea: the waterline and a faint band of water under it, the same for every ship. */}
              <span
                className="absolute inset-x-0 bottom-0 h-3 border-t border-dashed border-border-strong bg-primary/5"
                aria-hidden
              />
              {/* Shifted down by its draft, so the hull sits in the water. */}
              <div
                className="relative translate-y-[16%] transition-[width] duration-500"
                style={{ width: `${size * 100}%` }}
              >
                <div className="vessel-bob" style={{ animationDelay: `${index * 0.7}s` }}>
                  <Silhouette shape={fleet.shape} colourVar={colour.cssVar} />
                </div>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{vessel.name}</span>
                <span className="font-mono text-xs text-text-secondary tabular-nums">
                  {formatCapacity(vessel)} {fleet.unit}
                </span>
              </p>
              <p className="text-xs leading-relaxed text-text-secondary">{vessel.note}</p>
              <p className="text-[11px] text-muted-foreground">
                Source:{" "}
                {vessel.sources.map((s, i) => (
                  <span key={s.url}>
                    {i > 0 && "; "}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {s.label}
                    </a>
                  </span>
                ))}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** "Who carries what": the vessel classes of each commodity, with silhouettes sized by capacity. */
export function VesselClasses() {
  const [active, setActive] = useState<VesselCommodity>("crude");
  const fleet = FLEETS.find((f) => f.id === active) ?? FLEETS[0];
  return (
    <section
      aria-labelledby="vessel-classes"
      className="space-y-5 rounded-xl border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 id="vessel-classes" className="text-lg font-semibold tracking-tight">
            Who carries what
          </h2>
          <p className="max-w-2xl text-sm text-text-secondary">
            The main ship classes of each seaborne energy trade, largest first, with typical cargo
            capacities from public sources.
          </p>
        </div>
        <div
          role="group"
          aria-label="Commodity"
          className="flex max-w-full overflow-x-auto rounded-lg bg-muted p-0.5"
        >
          {FLEETS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === active}
              onClick={() => setActive(f.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors sm:text-sm",
                f.id === active
                  ? "bg-surface-raised font-medium text-foreground shadow-sm ring-1 ring-border"
                  : "text-text-secondary hover:text-foreground",
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", COMMODITIES[COLOUR[f.id]].bgClass)}
                aria-hidden
              />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Re-keyed on change, so the ships of the new group sail in. */}
      <Fleet key={fleet.id} fleet={fleet} />

      <p className="border-t pt-3 text-xs text-muted-foreground">
        Silhouettes are drawn for this site, not real ships; their length is proportional to the top
        cargo capacity within each commodity. Capacities are typical figures in the source&apos;s
        unit (oil tankers in barrels, gas carriers in m³), not measured cargoes. Which share of
        trade each class carries needs paid vessel-tracking data and is not shown.
      </p>
    </section>
  );
}
