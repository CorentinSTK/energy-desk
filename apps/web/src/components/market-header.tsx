import { COMMODITIES, type Commodity } from "@/lib/commodities";
import { cn } from "@/lib/utils";

interface MarketHeaderProps {
  commodity: Commodity;
  title: string;
  /** One sentence: what this page answers. */
  description: string;
  /** The 3–5 KpiCards of the market page template (BUILD_SPEC §3). */
  children?: React.ReactNode;
  className?: string;
}

export function MarketHeader({
  commodity,
  title,
  description,
  children,
  className,
}: MarketHeaderProps) {
  const style = COMMODITIES[commodity];
  return (
    <header className={cn("@container space-y-4", className)}>
      <div className="space-y-1">
        <p className={cn("flex items-center gap-2 text-xs font-medium uppercase", style.textClass)}>
          <span className={cn("size-2 rounded-full", style.bgClass)} aria-hidden />
          {style.label}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-text-secondary">{description}</p>
      </div>
      {children && (
        // Container queries: the grid follows the space the header gets, not the viewport.
        <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @4xl:grid-cols-4">{children}</div>
      )}
    </header>
  );
}
