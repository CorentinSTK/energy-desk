import "server-only";

import { cacheLife } from "next/cache";

import { db } from "./db";

/** A disruption event as published by IMF PortWatch (web.shipping_events, migration 011). */
export interface ShippingEvent {
  eventId: string;
  /** PortWatch's short code, e.g. "HORMUZ-26"; null when the source gives none. */
  code: string | null;
  name: string;
  description: string | null;
  alertLevel: string | null;
  /** PortWatch chokepoint ids, e.g. "chokepoint6". */
  chokepoints: string[];
  /** YYYY-MM-DD. */
  startsOn: string;
  /** YYYY-MM-DD, or null while the event is ongoing. */
  endsOn: string | null;
}

export async function getShippingEvents(): Promise<ShippingEvent[]> {
  "use cache";
  cacheLife("hours");
  const rows = await db()`
    select event_id, code, name, description, alert_level, chokepoints,
           to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on
    from web.shipping_events
    order by starts_on
  `;
  return rows.map((r) => ({
    eventId: r.event_id,
    code: r.code,
    name: r.name,
    description: r.description,
    alertLevel: r.alert_level,
    chokepoints: r.chokepoints,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
  }));
}
