import { TriangleAlert } from "lucide-react";

import type { ShippingEvent } from "@/lib/data/shipping-events";
import { formatDate } from "@/lib/format";

/** A disruption event exactly as the source publishes it: name, code, dates and alert level. */
export function SourceEventNotice({
  event,
  source,
  measured,
}: {
  event: ShippingEvent;
  source: string;
  /** Optional sentence computed from the transit data: is the disruption still visible today? */
  measured?: string;
}) {
  const period = `from ${formatDate(event.startsOn)}${
    event.endsOn ? ` to ${formatDate(event.endsOn)}` : ", ongoing"
  }`;
  return (
    <div className="flex gap-3 rounded-lg border border-warning/50 bg-warning/5 p-4 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">
          {event.name}
          {event.code && <span className="font-normal text-text-secondary"> ({event.code})</span>}
        </p>
        <p className="text-text-secondary">
          Disruption event published by {source}, {period}
          {event.alertLevel && `, alert level ${event.alertLevel}`}.
        </p>
        {measured && <p className="text-foreground">{measured}</p>}
      </div>
    </div>
  );
}
