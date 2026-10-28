import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MethodPopoverProps {
  /** What the method note is about, used in the button's accessible name. */
  subject: string;
  /** What the chart shows, how it is computed, caveats. */
  children: React.ReactNode;
}

/** The "i" button on every chart: what it shows, how it is computed, caveats (BUILD_SPEC §2.10). */
export function MethodPopover({ subject, children }: MethodPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Methodology: ${subject}`}
          className="text-muted-foreground"
        >
          <Info aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 text-sm text-text-secondary">
        {children}
      </PopoverContent>
    </Popover>
  );
}
