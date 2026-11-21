import { TriangleAlert } from "lucide-react";

import type { ShippingEvent } from "@/lib/data/shipping-events";
import { formatDate } from "@/lib/format";

/** A disruption event exactly as the source publishes it: name, code, dates and alert level. */
export function SourceEventNotice({ event, source }: { event: ShippingEvent; source: string }) {
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
      </div>
    </div>
  );
}
